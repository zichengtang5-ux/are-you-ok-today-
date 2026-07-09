import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

function todayString(): string {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

function monthRange(): { start: string; end: string } {
  const today = todayString();
  const start = today.slice(0, 8) + '01';
  const d = new Date(today + 'T00:00:00Z');
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const end = today.slice(0, 8) + String(lastDay).padStart(2, '0');
  return { start, end };
}

function isAfterWindowEnd(reminderConfig: { endTime: string } | null): boolean {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const endTimeStr = reminderConfig?.endTime ?? '22:00';
  const [hours, minutes] = endTimeStr.split(':').map(Number);
  const windowEnd = new Date(shanghai);
  windowEnd.setUTCHours(hours, minutes, 0, 0);
  return shanghai >= windowEnd;
}

@Injectable()
export class ReplyService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  async replyToday(userId: string) {
    const guardStatus = await this.prisma.guardStatus.findUnique({ where: { userId } });
    if (guardStatus?.status === 'paused') {
      const activePause = await this.prisma.pauseLog.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (activePause && activePause.endTime > new Date()) {
        throw new ConflictException('守护已暂停，请先恢复守护');
      }
      if (activePause) {
        await this.prisma.pauseLog.update({
          where: { id: activePause.id },
          data: { isActive: false },
        });
        await this.prisma.guardStatus.update({
          where: { userId },
          data: { status: 'idle' },
        });
      }
    }

    const date = todayString();
    const now = new Date();

    let record = await this.prisma.dailyRecord.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (record?.status === 'replied') {
      throw new BadRequestException('今天已回复');
    }

    record = await this.prisma.dailyRecord.upsert({
      where: { userId_date: { userId, date } },
      update: { status: 'replied', repliedAt: now, replyMethod: 'in_app' },
      create: {
        userId,
        date,
        status: 'replied',
        repliedAt: now,
        replyMethod: 'in_app',
      },
    });

    const updatedGuardStatus = await this.prisma.guardStatus.upsert({
      where: { userId },
      update: {
        status: 'replied',
        lastReplyAt: now,
        consecutiveTimeouts: 0,
      },
      create: {
        userId,
        status: 'replied',
        lastReplyAt: now,
      },
    });

    const activeAlert = await this.prisma.alertEvent.findFirst({
      where: { userId, status: 'active' },
    });

    if (activeAlert) {
      await this.prisma.alertEvent.update({
        where: { id: activeAlert.id },
        data: { status: 'resolved', resolvedAt: now },
      });
    }

    // 实时通知本人其它设备：回复确认，若同时解除了告警则额外广播
    await this.events.publish({ userId, type: 'reply_confirmed' });
    if (activeAlert) {
      await this.events.publish({ userId, type: 'alert_resolved' });
    }

    return {
      message: '收到，安心了',
      repliedAt: now.toISOString(),
      guardStatus: updatedGuardStatus.status,
      alertResolved: !!activeAlert,
    };
  }

  async undoReply(userId: string) {
    const date = todayString();

    const record = await this.prisma.dailyRecord.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (!record || record.status !== 'replied') {
      throw new BadRequestException('今天尚未回复');
    }

    const reminderConfig = await this.prisma.reminderConfig.findUnique({ where: { userId } });
    const afterWindow = isAfterWindowEnd(reminderConfig);
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
        const now = new Date();
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
    const date = todayString();

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

    const [todayRecord, reminderConfig, { start, end }] = await Promise.all([
      this.prisma.dailyRecord.findUnique({ where: { userId_date: { userId, date } } }),
      this.prisma.reminderConfig.findUnique({ where: { userId } }),
      Promise.resolve(monthRange()),
    ]);

    const monthRecords = await this.prisma.dailyRecord.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        status: 'replied',
      },
    });

    const todayDate = new Date(date + 'T00:00:00Z');
    const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
    const currentDay = todayDate.getDate();
    const repliedDays = monthRecords.length;

    return {
      status: guardStatus?.status ?? 'idle',
      lastReplyAt: guardStatus?.lastReplyAt?.toISOString() ?? null,
      todayReplied: todayRecord?.status === 'replied',
      todayRepliedAt: todayRecord?.repliedAt?.toISOString() ?? null,
      reminderConfig: reminderConfig ?? {
        startTime: '20:00',
        endTime: '22:00',
        gracePeriodMin: 30,
        timezone: 'Asia/Shanghai',
      },
      monthlyStats: {
        repliedDays,
        totalDays: currentDay,
        daysInMonth,
        display: `本月平安 ${repliedDays}/${currentDay} 天`,
      },
    };
  }

  async getStreak(userId: string) {
    const records = await this.prisma.dailyRecord.findMany({
      where: {
        userId,
        status: 'replied',
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    const repliedDates = new Set(records.map((record) => record.date));
    let cursor = todayString();
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
