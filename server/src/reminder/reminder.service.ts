import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeNextEndTimeDueAt } from './reminder-schedule.util';

@Injectable()
export class ReminderService {
  constructor(private prisma: PrismaService) {}

  async getConfig(userId: string) {
    let config = await this.prisma.reminderConfig.findUnique({ where: { userId } });

    if (!config) {
      const endTime = '22:00';
      const timezone = 'Asia/Shanghai';
      config = await this.prisma.reminderConfig.create({
        data: {
          userId,
          // 初始化 nextDueAt，否则调度引擎永远扫描不到该用户
          nextDueAt: computeNextEndTimeDueAt(new Date(), endTime, timezone),
        },
      });
    }

    return config;
  }

  async updateConfig(
    userId: string,
    data: { startTime?: string; endTime?: string; gracePeriodMin?: number; timezone?: string },
  ) {
    const current = await this.getConfig(userId);
    const startTime = data.startTime ?? current.startTime;
    const endTime = data.endTime ?? current.endTime;
    const timezone = data.timezone ?? current.timezone;

    if (!/^(?:[01]\d|2[0-3]):00$/.test(startTime) || !/^(?:[01]\d|2[0-3]):00$/.test(endTime)) {
      throw new BadRequestException('提醒时间须为 00:00 至 23:00 的整点');
    }
    if (startTime === endTime) {
      throw new BadRequestException('开始时间和结束时间不能相同');
    }
    if (
      data.gracePeriodMin !== undefined &&
      (!Number.isInteger(data.gracePeriodMin) || data.gracePeriodMin < 0 || data.gracePeriodMin > 120)
    ) {
      throw new BadRequestException('宽限时间须为 0 至 120 分钟');
    }
    try {
      new Intl.DateTimeFormat('zh-CN', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('时区格式不正确');
    }

    const updateData: Record<string, unknown> = {};
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.gracePeriodMin !== undefined) updateData.gracePeriodMin = data.gracePeriodMin;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;

    // endTime 或 timezone 变化时，重算 nextDueAt，保证调度引擎按新时间触发
    if (data.endTime !== undefined || data.timezone !== undefined) {
      updateData.nextDueAt = computeNextEndTimeDueAt(new Date(), endTime, timezone);
    }

    return this.prisma.reminderConfig.update({
      where: { userId },
      data: updateData,
    });
  }
}
