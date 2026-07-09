import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';

const PLAN_DURATION: Record<string, number> = {
  monthly: 30,
  yearly: 365,
};

const STOREKIT_BASE_URL = 'https://api.storekit.apple.com';
const STOREKIT_SANDBOX_URL = 'https://api.storekit-sandbox.apple.com';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private apiTokenCache: { token: string; expiresAt: number } | null = null;

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
    const nodeEnv = this.config.get('NODE_ENV', 'development');
    if (nodeEnv === 'development') {
      this.logger.log(`[MOCK IAP] Transaction verified: ${transactionId}`);
      return true;
    }

    try {
      const token = this.getApiToken();
      const baseUrl = nodeEnv === 'production' ? STOREKIT_BASE_URL : STOREKIT_SANDBOX_URL;
      const url = `${baseUrl}/inApps/v1/subscriptions/${transactionId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(
          `[Apple IAP] API 请求失败: status=${response.status} transactionId=${transactionId}`,
        );
        return false;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const subscriptionData = data as { data?: Array<{ lastTransactions?: Array<{ status?: number; signedTransactionInfo?: string }> }> };
      const subscriptionGroups = subscriptionData.data ?? [];

      for (const group of subscriptionGroups) {
        const transactions = group.lastTransactions ?? [];
        for (const tx of transactions) {
          if (tx.status === 1) {
            this.logger.log(`[Apple IAP] 订阅有效: transactionId=${transactionId}`);
            return true;
          }
        }
      }

      this.logger.warn(`[Apple IAP] 订阅无效或已过期: transactionId=${transactionId}`);
      return false;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Apple IAP] 校验异常: ${errMsg}`);
      return false;
    }
  }

  private getApiToken(): string {
    const now = Math.floor(Date.now() / 1000);
    if (this.apiTokenCache && this.apiTokenCache.expiresAt > now + 60) {
      return this.apiTokenCache.token;
    }

    const issuerId = this.config.get('APPLE_IAP_ISSUER_ID', '');
    const keyId = this.config.get('APPLE_IAP_KEY_ID', '');
    const keyPath = this.config.get('APPLE_IAP_KEY_PATH', '');
    const bundleId = this.config.get('APNS_BUNDLE_ID', 'com.todayok.app');

    if (!issuerId || !keyId || !keyPath) {
      throw new Error('Missing APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, or APPLE_IAP_KEY_PATH');
    }

    const privateKey = fs.readFileSync(keyPath, 'utf8');

    const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 3600,
      aud: 'appstoreconnect-v1',
      bid: bundleId,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const sign = crypto.createSign('SHA256');
    sign.update(signingInput);
    const derSignature = sign.sign(privateKey);
    const joseSignature = this.derToJose(derSignature);

    const token = `${signingInput}.${this.base64UrlEncodeBuffer(joseSignature)}`;
    this.apiTokenCache = { token, expiresAt: now + 3600 };

    return token;
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private base64UrlEncodeBuffer(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private derToJose(der: Buffer): Buffer {
    const r = this.extractDerInteger(der, 0);
    const s = this.extractDerInteger(der, r.offset);
    return Buffer.concat([
      this.padTo32Bytes(r.value),
      this.padTo32Bytes(s.value),
    ]);
  }

  private extractDerInteger(der: Buffer, offset: number): { value: Buffer; offset: number } {
    if (der[offset] !== 0x02) {
      throw new Error('Invalid DER: expected INTEGER tag');
    }
    const length = der[offset + 1];
    const value = der.subarray(offset + 2, offset + 2 + length);
    return { value, offset: offset + 2 + length };
  }

  private padTo32Bytes(buf: Buffer): Buffer {
    if (buf.length === 32) return buf;
    if (buf.length > 32) return buf.subarray(buf.length - 32);
    const padded = Buffer.alloc(32, 0);
    buf.copy(padded, 32 - buf.length);
    return padded;
  }
}
