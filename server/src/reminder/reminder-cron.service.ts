import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';
import { VoiceService } from '../voice/voice.service';

function todayString(): string {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

function currentShanghaiTime(): { hours: number; minutes: number; totalMinutes: number } {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const hours = shanghai.getUTCHours();
  const minutes = shanghai.getUTCMinutes();
  return { hours, minutes, totalMinutes: hours * 60 + minutes };
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class ReminderCronService {
  private readonly logger = new Logger(ReminderCronService.name);

  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
    private smsService: SmsService,
    private voiceService: VoiceService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleReminderCheck() {
    try {
      await this.checkReminders();
    } catch (error) {
      this.logger.error('Reminder check failed', error);
    }
  }

  async checkReminders() {
    const now = new Date();
    const currentTime = currentShanghaiTime();
    const date = todayString();

    const configs = await this.prisma.reminderConfig.findMany({
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

    for (const config of configs) {
      const { user } = config;

      if (!user.isOnboarded) continue;

      if (user.pauseLogs.length > 0) {
        const activePause = user.pauseLogs[0];
        if (activePause.endTime > now) continue;
      }

      if (user.guardStatus?.status === 'paused') continue;

      const endTimeMinutes = parseTime(config.endTime);
      if (currentTime.totalMinutes < endTimeMinutes) continue;

      const dailyRecord = await this.prisma.dailyRecord.findUnique({
        where: { userId_date: { userId: user.id, date } },
      });

      if (dailyRecord?.status === 'replied') continue;

      const gracePeriodMin = config.gracePeriodMin ?? 30;
      const graceDeadlineMinutes = endTimeMinutes + gracePeriodMin;
      const guardStatus = user.guardStatus?.status ?? 'idle';

      if (guardStatus === 'grace' || guardStatus === 'alert') {
        if (currentTime.totalMinutes >= graceDeadlineMinutes) {
          await this.triggerAlert(user, date, now);
        }
        continue;
      }

      if (currentTime.totalMinutes >= endTimeMinutes) {
        await this.sendCareReminder(user, config.endTime);
      }
    }
  }

  private async sendCareReminder(
    user: { id: string; nickname?: string | null; devices: { token: string }[] },
    endTime: string,
  ) {
    await this.prisma.guardStatus.upsert({
      where: { userId: user.id },
      update: { status: 'grace' },
      create: { userId: user.id, status: 'grace' },
    });

    const date = todayString();
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
      nickname?: string | null;
      devices: { token: string }[];
      contacts: { id: string; name: string; phone: string }[];
      guardStatus?: { id: string; lastReplyAt?: Date | null } | null;
    },
    date: string,
    now: Date,
  ) {
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
        { time: date + ' endTime', action: '发送了每日提醒' },
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

    for (const contact of user.contacts) {
      const message = `【今天还好】${nickname}今天没有回复平安，最后回复时间：${lastReplyAt}，请及时联系确认。`;
      await this.smsService.sendAlertSms(contact.phone, message);

      await this.prisma.notificationLog.create({
        data: {
          contactId: contact.id,
          channel: 'sms',
          round: existingAlert ? 2 : 1,
          status: 'sent',
          sentAt: now,
        },
      });
    }

    for (const contact of user.contacts) {
      const voiceResult = await this.voiceService.sendAlertVoice(
        contact.phone,
        nickname,
        lastReplyAt,
      );

      await this.prisma.notificationLog.create({
        data: {
          contactId: contact.id,
          channel: 'voice_call',
          round: existingAlert ? 2 : 1,
          status: voiceResult ? 'sent' : 'failed',
          sentAt: now,
        },
      });
    }

    this.logger.log(`Alert triggered for user ${user.id}, notified ${user.contacts.length} contacts via SMS + voice`);
  }
}
