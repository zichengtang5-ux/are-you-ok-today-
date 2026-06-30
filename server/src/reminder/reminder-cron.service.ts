import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';
import { VoiceService } from '../voice/voice.service';
import {
  computeGraceDeadlineDueAt,
  computeNextEndTimeDueAt,
  getLocalDateParts,
  isInShard,
  parseHhmmToMinutes,
} from './reminder-schedule.util';

/** 单批处理的最大记录数，避免一次性把整张表拉进内存 */
const BATCH_SIZE = 500;

@Injectable()
export class ReminderCronService {
  private readonly logger = new Logger(ReminderCronService.name);
  private readonly shardIndex: number;
  private readonly shardTotal: number;
  private running = false; // 防止上一轮未跑完时本轮重入

  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
    private smsService: SmsService,
    private voiceService: VoiceService,
    config: ConfigService,
  ) {
    this.shardIndex = config.get<number>('SCHEDULER_SHARD_INDEX', 0);
    this.shardTotal = config.get<number>('SCHEDULER_SHARD_TOTAL', 1);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleReminderCheck() {
    if (this.running) {
      this.logger.warn('Previous reminder check still running, skipping this tick');
      return;
    }
    this.running = true;
    const startedAt = Date.now();
    try {
      const processed = await this.checkDueReminders();
      this.logger.log(
        `Reminder check done: processed=${processed} shard=${this.shardIndex}/${this.shardTotal} took=${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      this.logger.error('Reminder check failed', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * 只扫描 nextDueAt <= now 的到期记录（走 @@index([nextDueAt])），分批处理。
   * 取代原"全表 findMany"，使每分钟的 DB 负载与"本分钟到期用户数"成正比，
   * 而非与"总用户数"成正比。
   */
  async checkDueReminders(): Promise<number> {
    const now = new Date();
    let totalProcessed = 0;

    // 分批拉取到期记录；每批处理后这些记录的 nextDueAt 会被推进到未来，
    // 因此下一批 cursor 自然前移，不会重复。
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const dueConfigs = await this.prisma.reminderConfig.findMany({
        where: { nextDueAt: { not: null, lte: now } },
        orderBy: { nextDueAt: 'asc' },
        take: BATCH_SIZE,
        include: {
          user: {
            include: {
              guardStatus: true,
              devices: true,
              pauseLogs: { where: { isActive: true } },
              contacts: { where: { verified: true }, orderBy: { priority: 'asc' } },
            },
          },
        },
      });

      if (dueConfigs.length === 0) break;

      for (const config of dueConfigs) {
        // 多实例分片：不属于本实例的用户直接跳过（但仍需推进 nextDueAt 由属主实例负责）
        if (!isInShard(config.userId, this.shardIndex, this.shardTotal)) {
          continue;
        }
        try {
          await this.processOne(config, now);
          totalProcessed++;
        } catch (err) {
          this.logger.error(`Failed to process reminder for user ${config.userId}`, err as Error);
          // 单用户失败不影响其他用户；推进 nextDueAt 避免卡死在同一条记录
          await this.advanceNextDueAt(config, now);
        }
      }

      if (dueConfigs.length < BATCH_SIZE) break;
    }

    return totalProcessed;
  }

  private async processOne(
    config: {
      userId: string;
      endTime: string;
      gracePeriodMin: number;
      timezone: string;
      user: {
        id: string;
        nickname: string | null;
        isOnboarded: boolean;
        guardStatus: { id: string; status: string; lastReplyAt: Date | null } | null;
        devices: { token: string }[];
        pauseLogs: { endTime: Date }[];
        contacts: { id: string; name: string; phone: string }[];
      };
    },
    now: Date,
  ): Promise<void> {
    const { user } = config;

    if (!user.isOnboarded) {
      await this.advanceNextDueAt(config, now);
      return;
    }

    // 暂停中：推进到暂停结束后的下一个 endTime
    if (user.pauseLogs.length > 0 && user.pauseLogs[0].endTime > now) {
      await this.prisma.reminderConfig.update({
        where: { userId: user.id },
        data: { nextDueAt: computeNextEndTimeDueAt(user.pauseLogs[0].endTime, config.endTime, config.timezone) },
      });
      return;
    }
    if (user.guardStatus?.status === 'paused') {
      await this.advanceNextDueAt(config, now);
      return;
    }

    const local = getLocalDateParts(now, config.timezone);
    const date = local.dateStr;
    const endMin = parseHhmmToMinutes(config.endTime);
    const graceDeadlineMin = endMin + config.gracePeriodMin;

    const dailyRecord = await this.prisma.dailyRecord.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    if (dailyRecord?.status === 'replied') {
      // 今天已回复，推进到明天的 endTime
      await this.advanceNextDueAt(config, now);
      return;
    }

    const guardStatus = user.guardStatus?.status ?? 'idle';

    // 已在 grace/alert：到达 grace deadline 则触发（或重复）告警
    if (guardStatus === 'grace' || guardStatus === 'alert') {
      if (local.minutesOfDay >= graceDeadlineMin) {
        await this.triggerAlert(user, date, now, config.endTime);
      }
      // 推进到下一个检查点：未到 deadline → deadline；已触发 → 明天
      const nextDue =
        local.minutesOfDay < graceDeadlineMin
          ? computeGraceDeadlineDueAt(date, config.endTime, config.gracePeriodMin, config.timezone)
          : computeNextEndTimeDueAt(now, config.endTime, config.timezone);
      await this.prisma.reminderConfig.update({ where: { userId: user.id }, data: { nextDueAt: nextDue } });
      return;
    }

    // idle 且已过 endTime → 进入 grace，发关怀提醒，nextDueAt 推进到 grace deadline
    if (local.minutesOfDay >= endMin) {
      await this.sendCareReminder(user, config.endTime);
      await this.prisma.reminderConfig.update({
        where: { userId: user.id },
        data: { nextDueAt: computeGraceDeadlineDueAt(date, config.endTime, config.gracePeriodMin, config.timezone) },
      });
      return;
    }

    // 还没到 endTime（理论上不该被扫到）→ 修正 nextDueAt
    await this.advanceNextDueAt(config, now);
  }

  /** 把 nextDueAt 推进到下一个 endTime（次日或今日尚未到的 endTime） */
  private async advanceNextDueAt(
    config: { userId: string; endTime: string; timezone: string },
    now: Date,
  ): Promise<void> {
    await this.prisma.reminderConfig.update({
      where: { userId: config.userId },
      data: { nextDueAt: computeNextEndTimeDueAt(now, config.endTime, config.timezone) },
    });
  }

  private async sendCareReminder(
    user: { id: string; nickname: string | null; devices: { token: string }[]; timezone?: string },
    endTime: string,
  ): Promise<void> {
    await this.prisma.guardStatus.upsert({
      where: { userId: user.id },
      update: { status: 'grace' },
      create: { userId: user.id, status: 'grace' },
    });

    const date = getLocalDateParts(new Date(), 'Asia/Shanghai').dateStr;
    await this.prisma.dailyRecord.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: { status: 'grace' },
      create: { userId: user.id, date, status: 'grace' },
    });

    for (const device of user.devices) {
      await this.pushService.sendCareReminder(device.token, user.nickname);
    }
    this.logger.log(`Care reminder sent for user ${user.id} (window ended at ${endTime})`);
  }

  private async triggerAlert(
    user: {
      id: string;
      nickname: string | null;
      devices: { token: string }[];
      contacts: { id: string; name: string; phone: string }[];
      guardStatus?: { id: string; lastReplyAt: Date | null } | null;
    },
    date: string,
    now: Date,
    endTime: string,
  ): Promise<void> {
    const guardStatus = await this.prisma.guardStatus.upsert({
      where: { userId: user.id },
      update: { status: 'alert', alertTriggeredAt: now },
      create: { userId: user.id, status: 'alert', alertTriggeredAt: now },
    });

    await this.prisma.dailyRecord.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: { status: 'alert' },
      create: { userId: user.id, date, status: 'alert' },
    });

    const lastReplyAt = user.guardStatus?.lastReplyAt?.toISOString() ?? '从未回复';
    const nickname = user.nickname ?? '用户';

    const existingAlert = await this.prisma.alertEvent.findFirst({
      where: { userId: user.id, status: 'active' },
    });

    if (!existingAlert) {
      const contactIds = JSON.stringify(user.contacts.map((c) => c.id));
      const timeline = JSON.stringify([
        { time: `${date} ${endTime}`, action: '发送了每日提醒' },
        { time: now.toISOString(), action: '通知了紧急联系人', isCurrent: true },
      ]);
      await this.prisma.alertEvent.create({
        data: {
          userId: user.id,
          guardStatusId: guardStatus.id,
          status: 'active',
          lastReplyAt: user.guardStatus?.lastReplyAt ?? null,
          contactsNotified: contactIds,
          timeline,
        },
      });
    }

    // NOTE: 通知投递目前仍为同步调用，P0-3 将改为 BullMQ 异步投递（重试+死信+回执）。
    const round = existingAlert ? 2 : 1;
    for (const contact of user.contacts) {
      const message = `【今天还好】${nickname}今天没有回复平安，最后回复时间：${lastReplyAt}，请及时联系确认。`;
      await this.smsService.sendAlertSms(contact.phone, message);
      await this.prisma.notificationLog.create({
        data: { contactId: contact.id, channel: 'sms', round, status: 'sent', sentAt: now },
      });
    }
    for (const contact of user.contacts) {
      const voiceResult = await this.voiceService.sendAlertVoice(contact.phone, nickname, lastReplyAt);
      await this.prisma.notificationLog.create({
        data: {
          contactId: contact.id,
          channel: 'voice_call',
          round,
          status: voiceResult ? 'sent' : 'failed',
          sentAt: now,
        },
      });
    }

    this.logger.log(
      `Alert triggered for user ${user.id}, notified ${user.contacts.length} contacts via SMS + voice`,
    );
  }
}
