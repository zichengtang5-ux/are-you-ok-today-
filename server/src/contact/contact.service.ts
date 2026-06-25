import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

const FREE_MAX_CONTACTS = 1;
const PREMIUM_MAX_CONTACTS = 5;
const CODE_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private prisma: PrismaService,
    private sms: SmsService,
    private config: ConfigService,
  ) {}

  async list(userId: string) {
    return this.prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
    });
  }

  async create(userId: string, data: { name: string; phone: string; relation?: string; priority?: number }) {
    const existing = await this.prisma.emergencyContact.findMany({ where: { userId } });
    const isPremium = await this.isPremium(userId);
    const maxContacts = isPremium ? PREMIUM_MAX_CONTACTS : FREE_MAX_CONTACTS;

    if (existing.length >= maxContacts) {
      throw new BadRequestException(
        isPremium
          ? `最多添加 ${maxContacts} 个联系人`
          : `免费版最多添加 ${maxContacts} 个联系人，升级守护版可添加更多`,
      );
    }

    const priority = data.priority ?? existing.length + 1;

    return this.prisma.emergencyContact.create({
      data: {
        userId,
        name: data.name,
        phone: data.phone,
        relation: data.relation ?? '家人',
        priority,
      },
    });
  }

  async update(userId: string, contactId: string, data: { name?: string; phone?: string; relation?: string; priority?: number }) {
    const contact = await this.prisma.emergencyContact.findUnique({ where: { id: contactId } });

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }
    if (contact.userId !== userId) {
      throw new ForbiddenException('无权操作此联系人');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) {
      updateData.phone = data.phone;
      updateData.verified = false;
    }
    if (data.relation !== undefined) updateData.relation = data.relation;
    if (data.priority !== undefined) updateData.priority = data.priority;

    return this.prisma.emergencyContact.update({
      where: { id: contactId },
      data: updateData,
    });
  }

  async remove(userId: string, contactId: string) {
    const contact = await this.prisma.emergencyContact.findUnique({ where: { id: contactId } });

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }
    if (contact.userId !== userId) {
      throw new ForbiddenException('无权操作此联系人');
    }

    const allContacts = await this.prisma.emergencyContact.findMany({ where: { userId } });
    if (allContacts.length <= 1) {
      throw new BadRequestException('至少保留 1 个紧急联系人');
    }

    await this.prisma.emergencyContact.delete({ where: { id: contactId } });
    return { message: '联系人已删除' };
  }

  async sendVerificationCode(userId: string, contactId: string) {
    const contact = await this.prisma.emergencyContact.findUnique({ where: { id: contactId } });

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }
    if (contact.userId !== userId) {
      throw new ForbiddenException('无权操作此联系人');
    }

    const recent = await this.prisma.verificationCode.findFirst({
      where: { phone: contact.phone },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const elapsed = Date.now() - recent.createdAt.getTime();
      if (elapsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return {
          message: '验证码已发送，请稍后再试',
          cooldownSeconds: remaining,
          ...(this.isMockMode() ? { mockCode: recent.code } : {}),
        };
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await this.prisma.verificationCode.create({
      data: { phone: contact.phone, code, expiresAt },
    });

    await this.sms.sendVerificationCode(contact.phone, code);
    this.logger.log(`Contact verification code sent to ${contact.phone.slice(0, 3)}****${contact.phone.slice(-4)}`);

    return {
      message: '验证码已发送',
      cooldownSeconds: 60,
      ...(this.isMockMode() ? { mockCode: code } : {}),
    };
  }

  async verify(userId: string, contactId: string, code: string) {
    const contact = await this.prisma.emergencyContact.findUnique({ where: { id: contactId } });

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }
    if (contact.userId !== userId) {
      throw new ForbiddenException('无权操作此联系人');
    }

    const record = await this.prisma.verificationCode.findFirst({
      where: {
        phone: contact.phone,
        code,
        usedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('验证码错误或已过期');
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const updated = await this.prisma.emergencyContact.update({
      where: { id: contactId },
      data: { verified: true },
    });

    return { message: '联系人已验证', contact: updated };
  }

  private async isPremium(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    return sub?.status === 'active' || sub?.status === 'trial';
  }

  private isMockMode(): boolean {
    return this.config.get('SMS_PROVIDER', 'mock') === 'mock';
  }
}
