import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

function todayString(): string {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

function formatTimelineTime(date: Date): string {
  const shanghai = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(11, 16);
}

function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[] = []): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

@Injectable()
export class AlertService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  async getActiveAlert(userId: string) {
    const activeAlert = await this.prisma.alertEvent.findFirst({
      where: { userId, status: 'active' },
      orderBy: { triggeredAt: 'desc' },
      include: {
        guardStatus: {
          select: { lastReplyAt: true },
        },
      },
    });

    if (!activeAlert) {
      return null;
    }

    return this.toAlertResponse(activeAlert.userId, activeAlert);
  }

  async getAlert(userId: string, alertId: string, contactId?: string) {
    const alert = await this.prisma.alertEvent.findUnique({
      where: { id: alertId },
      include: {
        guardStatus: {
          select: { lastReplyAt: true },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException('告警不存在');
    }

    await this.assertCanAccessAlert(userId, alert.userId, contactId);
    return this.toAlertResponse(alert.userId, alert);
  }

  async confirm(userId: string, alertId: string, contactId: string) {
    if (!contactId) {
      throw new BadRequestException('缺少联系人信息');
    }

    const alert = await this.findActionableAlert(alertId);
    const contact = await this.assertActionContact(userId, alert.userId, contactId);
    const now = new Date();
    const timeline = parseJsonArray<{ time: string; action: string; isCurrent?: boolean }>(alert.timeline).map(
      (item) => ({ ...item, isCurrent: false }),
    );
    timeline.push({
      time: formatTimelineTime(now),
      action: `${contact.name}确认：已联系，TA没事`,
      isCurrent: true,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.alertAction.create({
        data: {
          alertId,
          contactId,
          action: 'confirmed',
        },
      });

      await tx.alertEvent.update({
        where: { id: alertId },
        data: {
          status: 'confirmed',
          resolvedAt: now,
          timeline: JSON.stringify(timeline),
        },
      });

      await tx.guardStatus.upsert({
        where: { userId: alert.userId },
        update: {
          status: 'replied',
          lastReplyAt: now,
          consecutiveTimeouts: 0,
        },
        create: {
          userId: alert.userId,
          status: 'replied',
          lastReplyAt: now,
        },
      });

      await tx.dailyRecord.upsert({
        where: { userId_date: { userId: alert.userId, date: todayString() } },
        update: { status: 'replied', repliedAt: now, replyMethod: 'contact_confirm' },
        create: {
          userId: alert.userId,
          date: todayString(),
          status: 'replied',
          repliedAt: now,
          replyMethod: 'contact_confirm',
        },
      });
    });

    await this.events.publish({ userId: alert.userId, type: 'alert_resolved' });
    await this.events.publish({ userId: alert.userId, type: 'reply_confirmed' });

    return {
      message: '告警已解除',
      alert: {
        id: alertId,
        status: 'confirmed' as const,
        resolvedAt: now.toISOString(),
      },
    };
  }

  async needHelp(userId: string, alertId: string, contactId: string) {
    if (!contactId) {
      throw new BadRequestException('缺少联系人信息');
    }

    const alert = await this.findActionableAlert(alertId);
    const contact = await this.assertActionContact(userId, alert.userId, contactId);
    const now = new Date();
    const timeline = parseJsonArray<{ time: string; action: string; isCurrent?: boolean }>(alert.timeline).map(
      (item) => ({ ...item, isCurrent: false }),
    );
    timeline.push({
      time: formatTimelineTime(now),
      action: `${contact.name}标记：联系不上，需要帮助`,
      isCurrent: true,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.alertAction.create({
        data: {
          alertId,
          contactId,
          action: 'help_needed',
        },
      });

      await tx.alertEvent.update({
        where: { id: alertId },
        data: {
          status: 'help_needed',
          timeline: JSON.stringify(timeline),
        },
      });

      await tx.guardStatus.update({
        where: { userId: alert.userId },
        data: { status: 'alert', alertTriggeredAt: now },
      });
    });

    const [user, contacts] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: alert.userId },
        select: { phone: true, address: true },
      }),
      this.prisma.emergencyContact.findMany({
        where: { userId: alert.userId },
        orderBy: { priority: 'asc' },
      }),
    ]);

    return {
      message: '已记录需要帮助',
      alert: {
        id: alertId,
        status: 'help_needed' as const,
      },
      suggestedActions: [
        {
          type: 'call_user' as const,
          label: '拨打用户本人电话',
          phone: user?.phone,
        },
        {
          type: 'call_120' as const,
          label: '拨打 120 急救',
          address: user?.address ?? '',
        },
        {
          type: 'call_contact' as const,
          label: '联系其他紧急联系人',
          contacts: contacts
            .filter((c) => c.id !== contactId)
            .map((c) => ({
              id: c.id,
              name: c.name,
              phone: maskPhone(c.phone),
            })),
        },
      ],
    };
  }

  private async findActionableAlert(alertId: string) {
    const alert = await this.prisma.alertEvent.findUnique({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException('告警不存在');
    }
    if (alert.status !== 'active') {
      throw new BadRequestException('此告警已处理');
    }
    return alert;
  }

  private async assertCanAccessAlert(userId: string, alertOwnerId: string, contactId?: string) {
    if (userId === alertOwnerId) return;
    if (!contactId) {
      throw new ForbiddenException('无权查看此告警');
    }
    await this.assertActionContact(userId, alertOwnerId, contactId);
  }

  private async assertActionContact(userId: string, alertOwnerId: string, contactId: string) {
    const [currentUser, contact] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
      this.prisma.emergencyContact.findUnique({ where: { id: contactId } }),
    ]);

    if (!contact || contact.userId !== alertOwnerId) {
      throw new ForbiddenException('无权处理此告警');
    }

    const currentUserMatchesContact = !!currentUser && currentUser.phone === contact.phone;
    if (userId !== alertOwnerId && !currentUserMatchesContact) {
      throw new ForbiddenException('无权处理此告警');
    }

    return contact;
  }

  private async toAlertResponse(
    userId: string,
    alert: {
      id: string;
      triggeredAt: Date;
      contactsNotified: string;
      timeline: string;
      smsRounds: number;
      guardStatus: { lastReplyAt: Date | null };
    },
  ) {
    const contacts = await this.prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
    });

    const contactsNotifiedIds = parseJsonArray<string>(alert.contactsNotified);
    const contactsNotified = contacts
      .filter((c) => contactsNotifiedIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: maskPhone(c.phone),
      }));

    return {
      id: alert.id,
      triggeredAt: alert.triggeredAt.toISOString(),
      lastReplyAt: alert.guardStatus.lastReplyAt?.toISOString() ?? null,
      contactsNotified,
      smsRounds: alert.smsRounds,
      timeline: parseJsonArray(alert.timeline),
    };
  }
}
