import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const PLAN_DURATION: Record<string, number> = {
  monthly: 30,
  yearly: 365,
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async verify(userId: string, transactionId: string, plan: string) {
    const isValid = await this.validateAppleTransaction(transactionId);
    if (!isValid) {
      throw new BadRequestException('交易验证失败');
    }

    const durationDays = PLAN_DURATION[plan] ?? 30;
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + durationDays);

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: 'active',
        currentPeriodEnd,
        appleTransactionId: transactionId,
      },
      create: {
        userId,
        plan,
        status: 'active',
        currentPeriodEnd,
        appleTransactionId: transactionId,
      },
    });

    return {
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        originalTransactionId: transactionId,
        isTrial: false,
      },
    };
  }

  async proxySubscribe(guardianId: string, wardId: string, transactionId: string, plan: string) {
    const guardianRelation = await this.prisma.guardianRelation.findFirst({
      where: { guardianId, wardId, isBound: true },
    });

    if (!guardianRelation) {
      throw new ForbiddenException('无权为该用户开通订阅');
    }

    const isValid = await this.validateAppleTransaction(transactionId);
    if (!isValid) {
      throw new BadRequestException('交易验证失败');
    }

    const ward = await this.prisma.user.findUnique({ where: { id: wardId } });
    if (!ward) {
      throw new BadRequestException('被守护用户不存在');
    }

    const durationDays = PLAN_DURATION[plan] ?? 30;
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + durationDays);

    const subscription = await this.prisma.subscription.upsert({
      where: { userId: wardId },
      update: {
        plan,
        status: 'active',
        currentPeriodEnd,
        appleTransactionId: transactionId,
        paidBy: guardianId,
      },
      create: {
        userId: wardId,
        plan,
        status: 'active',
        currentPeriodEnd,
        appleTransactionId: transactionId,
        paidBy: guardianId,
      },
    });

    const wardName = ward.nickname ?? ward.phone;

    return {
      message: `已为${wardName}开通守护版`,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      },
      wardName,
    };
  }

  async getStatus(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return {
        plan: 'free',
        status: 'inactive',
        currentPeriodEnd: null,
        isPremium: false,
      };
    }

    const isPremium = subscription.status === 'active' || subscription.status === 'trial';

    if (isPremium && subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { status: 'expired' },
      });
      return {
        plan: subscription.plan,
        status: 'expired',
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        isPremium: false,
      };
    }

    return {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      isPremium,
    };
  }

  private async validateAppleTransaction(transactionId: string): Promise<boolean> {
    const provider = this.config.get('APNS_PROVIDER', 'mock');
    if (provider === 'mock' || this.config.get('NODE_ENV', 'development') === 'development') {
      this.logger.log(`[MOCK IAP] Transaction verified: ${transactionId}`);
      return true;
    }

    // TODO: 实现 App Store Server API 校验
    this.logger.warn(`[Apple IAP] Server API not implemented yet. transactionId=${transactionId}`);
    return false;
  }
}
