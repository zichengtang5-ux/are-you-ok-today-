import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReminderService {
  constructor(private prisma: PrismaService) {}

  async getConfig(userId: string) {
    let config = await this.prisma.reminderConfig.findUnique({ where: { userId } });

    if (!config) {
      config = await this.prisma.reminderConfig.create({
        data: { userId },
      });
    }

    return config;
  }

  async updateConfig(
    userId: string,
    data: { startTime?: string; endTime?: string; gracePeriodMin?: number; timezone?: string },
  ) {
    await this.getConfig(userId);

    const updateData: Record<string, unknown> = {};
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.gracePeriodMin !== undefined) updateData.gracePeriodMin = data.gracePeriodMin;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;

    return this.prisma.reminderConfig.update({
      where: { userId },
      data: updateData,
    });
  }
}
