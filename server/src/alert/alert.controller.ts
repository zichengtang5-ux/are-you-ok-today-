import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('告警')
@ApiBearerAuth()
@Controller('alert')
export class AlertController {
  constructor(private prisma: PrismaService) {}

  @Get('active')
  @ApiOperation({ summary: '获取当前活跃告警' })
  async getActiveAlert(@CurrentUser('id') userId: string) {
    const activeAlert = await this.prisma.alertEvent.findFirst({
      where: { userId, status: 'active' },
      include: {
        guardStatus: {
          select: { lastReplyAt: true },
        },
      },
    });

    if (!activeAlert) {
      return null;
    }

    const contacts = await this.prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
    });

    let contactsNotifiedIds: string[] = [];
    try {
      contactsNotifiedIds = JSON.parse(activeAlert.contactsNotified);
    } catch {
      contactsNotifiedIds = [];
    }

    const contactsNotified = contacts
      .filter((c) => contactsNotifiedIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      }));

    let timeline: Array<{ time: string; action: string; isCurrent?: boolean }> = [];
    try {
      timeline = JSON.parse(activeAlert.timeline);
    } catch {
      timeline = [];
    }

    return {
      id: activeAlert.id,
      triggeredAt: activeAlert.triggeredAt.toISOString(),
      lastReplyAt: activeAlert.guardStatus.lastReplyAt?.toISOString() ?? null,
      contactsNotified,
      timeline,
    };
  }
}
