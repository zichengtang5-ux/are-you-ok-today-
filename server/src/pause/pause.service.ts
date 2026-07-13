import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeNextEndTimeDueAt } from '../reminder/reminder-schedule.util';

@Injectable()
export class PauseService {
  constructor(private prisma: PrismaService) {}

  async pause(userId: string, days: number, reason?: string) {
    if (!Number.isInteger(days) || days < 1 || days > 14) {
      throw new BadRequestException('暂停时长需为 1 至 14 天');
    }
    const now = new Date();
    const pauseEnd = new Date(now);
    pauseEnd.setDate(pauseEnd.getDate() + days);
    const reminderConfig = await this.prisma.reminderConfig.findUnique({ where: { userId } });

    await this.prisma.$transaction(async (tx) => {
      await tx.pauseLog.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
      await tx.pauseLog.create({
        data: {
          userId,
          startTime: now,
          endTime: pauseEnd,
          reason: reason ?? null,
          isActive: true,
        },
      });
      await tx.guardStatus.upsert({
        where: { userId },
        update: { status: 'paused' },
        create: { userId, status: 'paused' },
      });
      if (reminderConfig) {
        await tx.reminderConfig.update({
          where: { userId },
          data: {
            nextDueAt: computeNextEndTimeDueAt(
              pauseEnd,
              reminderConfig.endTime,
              reminderConfig.timezone,
            ),
          },
        });
      }
    });

    return {
      message: '守护已暂停',
      pauseEndAt: pauseEnd.toISOString(),
      days,
    };
  }

  async resume(userId: string) {
    const [activePause, reminderConfig] = await Promise.all([
      this.prisma.pauseLog.findFirst({ where: { userId, isActive: true } }),
      this.prisma.reminderConfig.findUnique({ where: { userId } }),
    ]);

    if (!activePause) {
      throw new BadRequestException('当前没有暂停中的守护');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.pauseLog.update({
        where: { id: activePause.id },
        data: { isActive: false, endTime: now },
      });
      await tx.guardStatus.upsert({
        where: { userId },
        update: { status: 'idle' },
        create: { userId, status: 'idle' },
      });
      if (reminderConfig) {
        await tx.reminderConfig.update({
          where: { userId },
          data: {
            nextDueAt: computeNextEndTimeDueAt(
              now,
              reminderConfig.endTime,
              reminderConfig.timezone,
            ),
          },
        });
      }
    });

    return {
      message: '守护已恢复',
      guardStatus: 'idle',
    };
  }

  async getStatus(userId: string) {
    const activePause = await this.prisma.pauseLog.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!activePause) {
      return { isPaused: false };
    }

    const now = new Date();
    if (activePause.endTime <= now) {
      const reminderConfig = await this.prisma.reminderConfig.findUnique({ where: { userId } });
      await this.prisma.$transaction(async (tx) => {
        await tx.pauseLog.update({
          where: { id: activePause.id },
          data: { isActive: false },
        });
        await tx.guardStatus.upsert({
          where: { userId },
          update: { status: 'idle' },
          create: { userId, status: 'idle' },
        });
        if (reminderConfig) {
          await tx.reminderConfig.update({
            where: { userId },
            data: {
              nextDueAt: computeNextEndTimeDueAt(
                now,
                reminderConfig.endTime,
                reminderConfig.timezone,
              ),
            },
          });
        }
      });

      return { isPaused: false };
    }

    const diffMs = activePause.endTime.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      isPaused: true,
      pauseEndAt: activePause.endTime.toISOString(),
      daysRemaining,
      reason: activePause.reason ?? null,
    };
  }
}
