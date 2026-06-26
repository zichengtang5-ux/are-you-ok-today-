import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class HelpService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
  ) {}

  async emergency(
    userId: string,
    latitude?: number,
    longitude?: number,
    addressText?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        contacts: { where: { verified: true }, orderBy: { priority: 'asc' } },
      },
    });

    const resolvedAddress = addressText || user?.address || '';

    const helpRequest = await this.prisma.helpRequest.create({
      data: {
        userId,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        addressText: resolvedAddress,
      },
    });

    const contactsNotified = user?.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
    })) ?? [];

    const nickname = user?.nickname ?? '用户';
    const locationPart = resolvedAddress ? `，位置：${resolvedAddress}` : '';

    for (const contact of user?.contacts ?? []) {
      const message = `【今天还好】${nickname}发起了紧急求助${locationPart}，请尽快联系确认安全。`;
      await this.smsService.sendAlertSms(contact.phone, message);

      await this.prisma.notificationLog.create({
        data: {
          contactId: contact.id,
          channel: 'sms',
          round: 1,
          status: 'sent',
          sentAt: new Date(),
        },
      });
    }

    return {
      id: helpRequest.id,
      createdAt: helpRequest.createdAt.toISOString(),
      address: resolvedAddress,
      contactsNotified,
      message: `已通知所有紧急联系人`,
    };
  }

  async getAddress(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { address: true },
    });

    return {
      address: user?.address ?? '',
      source: 'user_preset' as const,
    };
  }
}
