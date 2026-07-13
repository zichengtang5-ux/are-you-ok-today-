import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  Status,
} from '@apple/app-store-server-library';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';

type SubscriptionPlan = 'monthly' | 'yearly';

interface AppleTransactionDetails {
  plan: SubscriptionPlan;
  transactionId: string;
  originalTransactionId: string;
  currentPeriodEnd: Date;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async verify(userId: string, transactionId: string, requestedPlan: string) {
    const plan = requestedPlan as SubscriptionPlan;
    const transaction = await this.validateAppleTransaction(transactionId, plan);
    if (!transaction) {
      throw new BadRequestException('交易验证失败');
    }

    const existingOwner = await this.prisma.subscription.findFirst({
      where: {
        OR: [
          { appleTransactionId: transaction.transactionId },
          { appleOriginalTransactionId: transaction.originalTransactionId },
        ],
      },
    });
    if (existingOwner && existingOwner.userId !== userId) {
      throw new BadRequestException('该 Apple 订阅已绑定其他账号');
    }

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan: transaction.plan,
        status: 'active',
        currentPeriodEnd: transaction.currentPeriodEnd,
        appleTransactionId: transaction.transactionId,
        appleOriginalTransactionId: transaction.originalTransactionId,
      },
      create: {
        userId,
        plan: transaction.plan,
        status: 'active',
        currentPeriodEnd: transaction.currentPeriodEnd,
        appleTransactionId: transaction.transactionId,
        appleOriginalTransactionId: transaction.originalTransactionId,
      },
    });

    return {
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        originalTransactionId: transaction.originalTransactionId,
        isTrial: false,
      },
    };
  }

  async getStatus(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });

    if (!subscription) {
      return {
        plan: 'free',
        status: 'inactive',
        currentPeriodEnd: null,
        isPremium: false,
      };
    }

    const isPremium = subscription.status === 'active' || subscription.status === 'trial';
    if (isPremium && subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()) {
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

  private async validateAppleTransaction(
    transactionId: string,
    requestedPlan: SubscriptionPlan,
  ): Promise<AppleTransactionDetails | null> {
    const nodeEnv = this.config.get('NODE_ENV', 'development');
    if (nodeEnv === 'development') {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + (requestedPlan === 'yearly' ? 365 : 30));
      this.logger.log(`[MOCK IAP] Transaction verified: ${transactionId}`);
      return {
        plan: requestedPlan,
        transactionId,
        originalTransactionId: transactionId,
        currentPeriodEnd,
      };
    }

    try {
      const { client, verifier, bundleId } = this.createAppleClients();
      const response = await client.getAllSubscriptionStatuses(transactionId, [Status.ACTIVE]);
      if (response.bundleId && response.bundleId !== bundleId) {
        this.logger.error(`[Apple IAP] Bundle mismatch: ${response.bundleId}`);
        return null;
      }

      const expectedProductId = this.getProductIds()[requestedPlan];
      const candidates: AppleTransactionDetails[] = [];
      for (const group of response.data ?? []) {
        for (const item of group.lastTransactions ?? []) {
          if (item.status !== Status.ACTIVE || !item.signedTransactionInfo) continue;
          const decoded = await verifier.verifyAndDecodeTransaction(item.signedTransactionInfo);
          if (
            decoded.productId !== expectedProductId ||
            decoded.bundleId !== bundleId ||
            !decoded.transactionId ||
            !decoded.originalTransactionId ||
            !decoded.expiresDate ||
            decoded.expiresDate <= Date.now() ||
            decoded.revocationDate
          ) {
            continue;
          }
          candidates.push({
            plan: requestedPlan,
            transactionId: decoded.transactionId,
            originalTransactionId: decoded.originalTransactionId,
            currentPeriodEnd: new Date(decoded.expiresDate),
          });
        }
      }

      return candidates.sort(
        (a, b) => b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime(),
      )[0] ?? null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Apple IAP] Validation failed: ${message}`);
      return null;
    }
  }

  private createAppleClients(): {
    client: AppStoreServerAPIClient;
    verifier: SignedDataVerifier;
    bundleId: string;
  } {
    const issuerId = this.requiredConfig('APPLE_IAP_ISSUER_ID');
    const keyId = this.requiredConfig('APPLE_IAP_KEY_ID');
    const keyPath = this.requiredConfig('APPLE_IAP_KEY_PATH');
    const rootCaPaths = this.requiredConfig('APPLE_ROOT_CA_PATHS')
      .split(',')
      .map((path) => path.trim())
      .filter(Boolean);
    const bundleId = this.config.get('APNS_BUNDLE_ID', 'com.todayok.app');
    const nodeEnv = this.config.get('NODE_ENV', 'development');
    const environment = nodeEnv === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;
    const signingKey = fs.readFileSync(keyPath, 'utf8');
    const roots = rootCaPaths.map((path) => fs.readFileSync(path));
    const appAppleIdValue = this.config.get('APPLE_APP_ID', '');
    const appAppleId = appAppleIdValue ? Number(appAppleIdValue) : undefined;
    if (environment === Environment.PRODUCTION && !Number.isInteger(appAppleId)) {
      throw new Error('Missing or invalid APPLE_APP_ID');
    }

    return {
      client: new AppStoreServerAPIClient(signingKey, keyId, issuerId, bundleId, environment),
      verifier: new SignedDataVerifier(
        roots,
        true,
        environment,
        bundleId,
        appAppleId,
      ),
      bundleId,
    };
  }

  private getProductIds(): Record<SubscriptionPlan, string> {
    return {
      monthly: this.config.get(
        'APPLE_IAP_MONTHLY_PRODUCT_ID',
        'com.todayok.subscription.monthly',
      ),
      yearly: this.config.get(
        'APPLE_IAP_YEARLY_PRODUCT_ID',
        'com.todayok.subscription.yearly',
      ),
    };
  }

  private requiredConfig(key: string): string {
    const value = this.config.get<string>(key, '');
    if (!value) throw new Error(`Missing ${key}`);
    return value;
  }
}
