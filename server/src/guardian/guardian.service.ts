import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReplyService } from '../alert/reply.service';
import { randomBytes } from 'crypto';

const MAX_GUARDIAN_RELATIONS = 5;

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function todayString(timezone: string): string {
  const now = new Date();
  // Asia/Shanghai = UTC+8
  const offsetHours = timezone === 'Asia/Shanghai' ? 8 : 8;
  const local = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function monthRange(timezone: string): { start: string; end: string; daysInMonth: number; currentDay: number } {
  const today = todayString(timezone);
  const start = today.slice(0, 8) + '01';
  const d = new Date(today + 'T00:00:00Z');
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const currentDay = d.getDate();
  const end = today.slice(0, 8) + String(daysInMonth).padStart(2, '0');
  return { start, end, daysInMonth, currentDay };
}

@Injectable()
export class GuardianService {
  constructor(
    private prisma: PrismaService,
    private replyService: ReplyService,
  ) {}

  async create(guardianId: string, wardName: string, wardPhone: string, relation: string) {
    const guardian = await this.prisma.user.findUnique({ where: { id: guardianId } });
    if (!guardian) throw new NotFoundException('用户不存在');

    if (guardian.phone === wardPhone) {
      throw new BadRequestException('不能守护自己');
    }

    const existingCount = await this.prisma.guardianRelation.count({
      where: { guardianId },
    });
    if (existingCount >= MAX_GUARDIAN_RELATIONS) {
      throw new BadRequestException('GUARDIAN_LIMIT_EXCEEDED');
    }

    let ward = await this.prisma.user.findUnique({ where: { phone: wardPhone } });
    if (!ward) {
      ward = await this.prisma.user.create({
        data: { phone: wardPhone, nickname: wardName, onboardingStep: 'invite_pending' },
      });
    }

    const existingRelation = await this.prisma.guardianRelation.findUnique({
      where: { guardianId_wardId: { guardianId, wardId: ward.id } },
    });
    if (existingRelation) {
      throw new BadRequestException('已存在守护关系');
    }

    const inviteCode = generateInviteCode();

    const guardianRelation = await this.prisma.guardianRelation.create({
      data: {
        guardianId,
        wardId: ward.id,
        relation: relation || '子女',
        inviteCode,
        isBound: false,
      },
    });

    return {
      id: guardianRelation.id,
      inviteCode: guardianRelation.inviteCode,
      inviteLink: `todayok://invite/${inviteCode}`,
      isBound: false,
      wardName,
      wardPhone,
    };
  }

  async acceptInvite(userId: string, inviteCode: string) {
    const normalizedCode = inviteCode.toUpperCase().trim();

    const relation = await this.prisma.guardianRelation.findFirst({
      where: { inviteCode: normalizedCode },
      include: { guardian: { select: { id: true, nickname: true } } },
    });

    if (!relation) {
      throw new NotFoundException('邀请码无效或已过期');
    }

    if (relation.isBound) {
      throw new BadRequestException('邀请已被使用');
    }

    await this.prisma.guardianRelation.update({
      where: { id: relation.id },
      data: { wardId: userId, isBound: true },
    });

    return {
      message: '绑定成功',
      guardian: {
        id: relation.guardian.id,
        guardianName: relation.guardian.nickname,
      },
    };
  }

  async getWards(guardianId: string) {
    const relations = await this.prisma.guardianRelation.findMany({
      where: { guardianId },
      include: {
        ward: {
          include: {
            guardStatus: true,
            reminderConfig: true,
          },
        },
      },
    });

    return Promise.all(
      relations.map(async (rel) => {
        const ward = rel.ward;
        const lastReplyAt = ward.guardStatus?.lastReplyAt;
        const status = ward.guardStatus?.status ?? 'idle';
        const reminderConfig = ward.reminderConfig;

        return {
          id: rel.id,
          wardName: ward.nickname || ward.phone,
          wardPhone: ward.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
          relation: rel.relation,
          isBound: rel.isBound,
          status,
          lastReplyAt: lastReplyAt?.toISOString() ?? null,
          reminderConfig: reminderConfig
            ? { startTime: reminderConfig.startTime, endTime: reminderConfig.endTime }
            : { startTime: '20:00', endTime: '22:00' },
        };
      }),
    );
  }

  async getDashboard(guardianId: string, relationId: string) {
    const relation = await this.prisma.guardianRelation.findUnique({
      where: { id: relationId },
      include: {
        ward: {
          include: {
            guardStatus: true,
            reminderConfig: true,
            subscription: true,
          },
        },
      },
    });

    if (!relation || relation.guardianId !== guardianId) {
      throw new ForbiddenException('无权访问');
    }

    const ward = relation.ward;
    const nickname = ward.nickname || ward.phone;
    const status = ward.guardStatus?.status ?? 'idle';
    const lastReplyAt = ward.guardStatus?.lastReplyAt?.toISOString() ?? null;

    const guardian = await this.prisma.user.findUnique({ where: { id: guardianId } });
    const guardianIsPremium = await this.isPremium(guardianId);

    if (!guardianIsPremium) {
      return {
        wardName: nickname,
        status,
        lastReplyAt,
        recentDays: null,
        monthlyStats: null,
        history: null,
        isPremium: false,
        upgradeHint: '升级守护版查看完整关怀数据',
      };
    }

    const tz = ward.reminderConfig?.timezone ?? 'Asia/Shanghai';
    const { start, end, daysInMonth, currentDay } = monthRange(tz);

    const monthRecords = await this.prisma.dailyRecord.findMany({
      where: {
        userId: ward.id,
        date: { gte: start, lte: end },
        status: 'replied',
      },
      orderBy: { date: 'desc' },
    });

    const recentDays = Array.from({ length: Math.min(currentDay, 7) }, (_, i) => {
      const d = new Date(todayString(tz) + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const replied = monthRecords.some((r) => r.date === dateStr);
      return { date: dateStr, replied };
    });

    const repliedDays = monthRecords.length;

    const alertEvents = await this.prisma.alertEvent.findMany({
      where: { userId: ward.id },
      orderBy: { triggeredAt: 'desc' },
      take: 10,
    });

    const history = alertEvents.map((ae) => ({
      date: ae.triggeredAt.toISOString().slice(0, 10),
      event: `${nickname}未回复，守护人确认了'TA没事'`,
    }));

    return {
      wardName: nickname,
      status,
      lastReplyAt,
      recentDays,
      monthlyStats: {
        repliedDays,
        totalDays: currentDay,
        display: `本月平安 ${repliedDays}/${currentDay} 天`,
      },
      history,
      isPremium: true,
    };
  }

  async proxyReply(guardianId: string, relationId: string) {
    const relation = await this.prisma.guardianRelation.findUnique({
      where: { id: relationId },
    });

    if (!relation || relation.guardianId !== guardianId) {
      throw new ForbiddenException('无权操作');
    }

    const wardId = relation.wardId;

    try {
      const result = await this.replyService.replyToday(wardId);
      return {
        message: '已代确认',
        guardStatus: result.guardStatus,
      };
    } catch (err) {
      if (err instanceof BadRequestException && (err.message as string).includes('已回复')) {
        return {
          message: '已代确认',
          guardStatus: 'replied',
        };
      }
      throw err;
    }
  }

  private async isPremium(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    return sub?.status === 'active' || sub?.status === 'trial';
  }
}
