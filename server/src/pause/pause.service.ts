import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PauseService {
  constructor(private prisma: PrismaService) {}

  async pause(userId: string, days: number, reason?: string) {
    const now = new Date();
    const pauseEnd = new Date(now);
    pauseEnd.setDate(pauseEnd.getDate() + days);

    await this.prisma.pauseLog.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    await this.prisma.pauseLog.create({
      data: {
        userId,
        startTime: now,
        endTime: pauseEnd,
        reason: reason ?? null,
        isActive: true,
      },
    });

    await this.prisma.guardStatus.upsert({
      where: { userId },
      update: { status: 'paused' },
      create: { userId, status: 'paused' },
    });

    return {
      message: '守护已暂停',
      pauseEndAt: pauseEnd.toISOString(),
      days,
    };
  }

  async resume(userId: string) {
    const activePause = await this.prisma.pauseLog.findFirst({
      where: { userId, isActive: true },
    });

    if (!activePause) {
      throw new BadRequestException('当前没有暂停中的守护');
    }

    await this.prisma.pauseLog.update({
      where: { id: activePause.id },
      data: { isActive: false, endTime: new Date() },
    });

    await this.prisma.guardStatus.upsert({
      where: { userId },
      update: { status: 'idle' },
      create: { userId, status: 'idle' },
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
      await this.prisma.pauseLog.update({
        where: { id: activePause.id },
        data: { isActive: false },
      });

      await this.prisma.guardStatus.upsert({
        where: { userId },
        update: { status: 'idle' },
        create: { userId, status: 'idle' },
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
