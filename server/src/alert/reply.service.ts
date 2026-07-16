import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import {
  computeGraceDeadlineDueAt,
  getGuardDateForMoment,
  getLocalDateParts,
  getWindowEndDate,
  isAfterWindowEnd,
  isOvernightWindow,
  parseHhmmToMinutes,
} from '../reminder/reminder-schedule.util';

type ReplyMethod = 'in_app' | 'notification_action' | 'apple_watch';

function monthRange(date: string): { start: string; end: string; daysInMonth: number } {
  const start = date.slice(0, 8) + '01';
  const d = new Date(date + 'T00:00:00Z');
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const end = date.slice(0, 8) + String(daysInMonth).padStart(2, '0');
  return { start, end, daysInMonth };
}

const DEFAULT_REMINDER = {
  startTime: '20:00',
  endTime: '22:00',
  gracePeriodMin: 30,
  timezone: 'Asia/Shanghai',
};

function getScheduledStatus(
  at: Date,
  config: { startTime: string; endTime: string; timezone: string },
): 'idle' | 'waiting' {
  const { minutesOfDay } = getLocalDateParts(at, config.timezone);
  const startMin = parseHhmmToMinutes(config.startTime);
  const endMin = parseHhmmToMinutes(config.endTime);
  const isWaiting = isOvernightWindow(config.startTime, config.endTime)
    ? minutesOfDay >= startMin || minutesOfDay < endMin
    : minutesOfDay >= startMin && minutesOfDay < endMin;
  return isWaiting ? 'waiting' : 'idle';
}

@Injectable()
export class ReplyService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  async replyToday(userId: string, replyMethod: ReplyMethod = 'in_app') {
    const now = new Date();
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const [guardStatus, activePause, reminderConfigRecord] = await Promise.all([
        tx.guardStatus.findUnique({ where: { userId } }),
        tx.pauseLog.findFirst({
          where: { userId, isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
        tx.reminderConfig.findUnique({ where: { userId } }),
      ]);

      if (activePause && activePause.endTime > now) {
        throw new ConflictException('守护已暂停，请先恢复守护');
      }
      if (activePause) {
        await tx.pauseLog.update({
          where: { id: activePause.id },
          data: { isActive: false },
        });
      }

      const reminderConfig = reminderConfigRecord ?? DEFAULT_REMINDER;
      const date = getGuardDateForMoment(now, reminderConfig, guardStatus?.status);
      const existingRecord = await tx.dailyRecord.findUnique({
        where: { userId_date: { userId, date } },
      });
      const wasAlreadyReplied = existingRecord?.status === 'replied';
      const record = wasAlreadyReplied
        ? existingRecord
        : await tx.dailyRecord.upsert({
            where: { userId_date: { userId, date } },
            update: { status: 'replied', repliedAt: now, replyMethod },
            create: {
              userId,
              date,
              status: 'replied',
              repliedAt: now,
              replyMethod,
            },
          });

      const updatedGuardStatus = await tx.guardStatus.upsert({
        where: { userId },
        update: {
          status: 'replied',
          lastReplyAt: record.repliedAt ?? now,
          consecutiveTimeouts: 0,
        },
        create: {
          userId,
          status: 'replied',
          lastReplyAt: record.repliedAt ?? now,
        },
      });

      const activeAlert = await tx.alertEvent.findFirst({
        where: { userId, status: 'active' },
      });
      if (activeAlert) {
        await tx.alertEvent.update({
          where: { id: activeAlert.id },
          data: { status: 'resolved', resolvedAt: now },
        });
      }

      return {
        wasAlreadyReplied,
        repliedAt: record.repliedAt ?? now,
        guardStatus: updatedGuardStatus.status,
        alertResolved: !!activeAlert,
      };
    });

    // 实时通知本人其它设备：回复确认，若同时解除了告警则额外广播
    if (!transactionResult.wasAlreadyReplied || transactionResult.alertResolved) {
      await this.events.publish({ userId, type: 'reply_confirmed' });
    }
    if (transactionResult.alertResolved) {
      await this.events.publish({ userId, type: 'alert_resolved' });
    }

    return {
      message: transactionResult.wasAlreadyReplied ? '今天已回复' : '收到，安心了',
      repliedAt: transactionResult.repliedAt.toISOString(),
      guardStatus: transactionResult.guardStatus,
      alertResolved: transactionResult.alertResolved,
    };
  }

  async undoReply(userId: string) {
    const now = new Date();
    const reminderConfig =
      await this.prisma.reminderConfig.findUnique({ where: { userId } }) ?? DEFAULT_REMINDER;
    const date = getGuardDateForMoment(now, reminderConfig, 'replied');

    const record = await this.prisma.dailyRecord.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (!record || record.status !== 'replied') {
      throw new BadRequestException('今天尚未回复');
    }

    const afterWindow = isAfterWindowEnd(now, reminderConfig);
    const newStatus = afterWindow ? 'grace' : 'waiting';

    await this.prisma.dailyRecord.update({
      where: { id: record.id },
      data: { status: newStatus, repliedAt: null, replyMethod: null },
    });

    await this.prisma.guardStatus.update({
      where: { userId },
      data: { status: newStatus },
    });

    if (afterWindow) {
      const guardStatus = await this.prisma.guardStatus.findUnique({ where: { userId } });
      const existingActive = await this.prisma.alertEvent.findFirst({
        where: { userId, status: 'active' },
      });
      if (!existingActive && guardStatus) {
        await this.prisma.alertEvent.create({
          data: {
            userId,
            guardStatusId: guardStatus.id,
            status: 'active',
            lastReplyAt: null,
            triggeredAt: now,
            contactsNotified: '[]',
            timeline: JSON.stringify([
              { time: now.toISOString().slice(11, 16), action: '回复被撤回，重新进入告警' },
            ]),
          },
        });
      }
    }

    return { message: '已撤回回复', guardStatus: newStatus };
  }

  async getStatus(userId: string) {
    const guardStatus = await this.prisma.guardStatus.findUnique({ where: { userId } });

    if (guardStatus?.status === 'paused') {
      const activePause = await this.prisma.pauseLog.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (activePause && activePause.endTime <= new Date()) {
        await this.prisma.pauseLog.update({
          where: { id: activePause.id },
          data: { isActive: false },
        });
        await this.prisma.guardStatus.update({
          where: { userId },
          data: { status: 'idle' },
        });
        guardStatus.status = 'idle';
      }
    }

    const reminderConfig =
      await this.prisma.reminderConfig.findUnique({ where: { userId } }) ?? DEFAULT_REMINDER;
    const date = getGuardDateForMoment(new Date(), reminderConfig, guardStatus?.status);
    const [todayRecord, { start, end, daysInMonth }] = await Promise.all([
      this.prisma.dailyRecord.findUnique({ where: { userId_date: { userId, date } } }),
      Promise.resolve(monthRange(date)),
    ]);

    const monthRecords = await this.prisma.dailyRecord.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        status: 'replied',
      },
    });

    const repliedDays = monthRecords.length;
    const persistedStatus = guardStatus?.status;
    const effectiveStatus =
      persistedStatus === 'paused'
        ? 'paused'
        : persistedStatus === 'alert'
          ? 'alert'
          : todayRecord?.status === 'replied'
            ? 'replied'
            : todayRecord?.status === 'grace' || persistedStatus === 'grace'
              ? 'grace'
              : getScheduledStatus(new Date(), reminderConfig);
    const graceDeadlineAt = effectiveStatus === 'grace'
      ? computeGraceDeadlineDueAt(
          getWindowEndDate(date, reminderConfig.startTime, reminderConfig.endTime),
          reminderConfig.endTime,
          reminderConfig.gracePeriodMin,
          reminderConfig.timezone,
        ).toISOString()
      : null;

    return {
      status: effectiveStatus,
      lastReplyAt: guardStatus?.lastReplyAt?.toISOString() ?? null,
      todayReplied: todayRecord?.status === 'replied',
      todayRepliedAt: todayRecord?.repliedAt?.toISOString() ?? null,
      reminderConfig,
      graceDeadlineAt,
      monthlyStats: {
        repliedDays,
        totalDays: daysInMonth,
        daysInMonth,
        display: `本月平安 ${repliedDays}/${daysInMonth} 天`,
      },
    };
  }

  async getStreak(userId: string) {
    const [records, reminderConfig] = await Promise.all([
      this.prisma.dailyRecord.findMany({
        where: {
          userId,
          status: 'replied',
        },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.prisma.reminderConfig.findUnique({ where: { userId } }),
    ]);

    const repliedDates = new Set(records.map((record) => record.date));
    let cursor = getGuardDateForMoment(
      new Date(),
      reminderConfig ?? DEFAULT_REMINDER,
    );
    let streak = 0;

    while (repliedDates.has(cursor)) {
      streak += 1;
      const date = new Date(`${cursor}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - 1);
      cursor = date.toISOString().slice(0, 10);
    }

    return { streak };
  }
}
