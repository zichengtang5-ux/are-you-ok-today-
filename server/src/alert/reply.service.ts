import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class ReplyService {
  constructor(private prisma: PrismaService) {}

  async replyToday(userId: string) {
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

    const guardStatus = await this.prisma.guardStatus.upsert({
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

    return {
      message: '收到，安心了',
      repliedAt: now.toISOString(),
      guardStatus: guardStatus.status,
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

    await this.prisma.dailyRecord.update({
      where: { id: record.id },
      data: { status: 'waiting', repliedAt: null, replyMethod: null },
    });

    await this.prisma.guardStatus.update({
      where: { userId },
      data: { status: 'waiting' },
    });

    return { message: '已撤回回复', guardStatus: 'waiting' };
  }

  async getStatus(userId: string) {
    const date = todayString();

    const [guardStatus, todayRecord, reminderConfig, { start, end }] = await Promise.all([
      this.prisma.guardStatus.findUnique({ where: { userId } }),
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
}
