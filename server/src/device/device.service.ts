import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(userId: string, token: string, platform: string) {
    await this.prisma.device.upsert({
      where: { userId_token: { userId, token } },
      update: { platform },
      create: { userId, token, platform },
    });

    return { message: '设备已注册' };
  }

  async getDevicesByUserId(userId: string) {
    return this.prisma.device.findMany({ where: { userId } });
  }
}
