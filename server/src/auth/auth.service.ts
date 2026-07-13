import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import {
  hasPremiumEntitlement,
  limitContactsForSubscription,
} from '../subscription/subscription-entitlement';

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 60 * 1000; // 60 seconds
const DEV_LOGIN_CODE = '123456';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private sms: SmsService,
  ) {}

  async sendCode(phone: string): Promise<{ message: string; cooldownSeconds: number; mockCode?: string }> {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('手机号格式不正确');
    }

    const recent = await this.prisma.verificationCode.findFirst({
      where: { phone },
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

    const code = this.isDevAuthMockEnabled() ? DEV_LOGIN_CODE : this.generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    const record = await this.prisma.verificationCode.create({
      data: { phone, code, expiresAt },
    });

    const sent = await this.sms.sendVerificationCode(phone, code);
    if (!sent) {
      await this.prisma.verificationCode
        .delete({ where: { id: record.id } })
        .catch(() => undefined);
      throw new ServiceUnavailableException('验证码发送失败，请稍后重试');
    }

    this.logger.log(`Verification code sent to ${phone.slice(0, 3)}****${phone.slice(-4)}`);

    return {
      message: '验证码已发送',
      cooldownSeconds: 60,
      ...(this.isMockMode() ? { mockCode: code } : {}),
    };
  }

  async verifyCode(phone: string, code: string): Promise<{ accessToken: string; refreshToken: string; user: { id: string; phone: string; nickname: string | null; isOnboarded: boolean; onboardingStep: string } }> {
    if (!phone || !code) {
      throw new BadRequestException('手机号和验证码不能为空');
    }

    const record = await this.prisma.verificationCode.findFirst({
      where: {
        phone,
        code,
        usedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record && !this.isDevAuthMockCode(code)) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    if (record) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    }

    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, onboardingStep: 'basic-info' },
      });
    } else if (!user.isOnboarded && user.onboardingStep === 'agreement') {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { onboardingStep: 'basic-info' },
      });
    }

    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        isOnboarded: user.isOnboarded,
        onboardingStep: user.onboardingStep,
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('无效的刷新令牌');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      return this.generateTokens(user.id);
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        contacts: { orderBy: { priority: 'asc' } },
        reminderConfig: true,
        guardStatus: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const isPremium = hasPremiumEntitlement(user.subscription);

    return {
      ...user,
      contacts: limitContactsForSubscription(user.contacts, user.subscription),
      isPremium,
    };
  }

  private async generateTokens(userId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ sub: userId, type: 'access' }, {
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwt.signAsync({ sub: userId, type: 'refresh' }, {
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private isMockMode(): boolean {
    return this.config.get('SMS_PROVIDER', 'mock') === 'mock';
  }

  private isDevAuthMockEnabled(): boolean {
    return this.config.get('NODE_ENV', 'development') !== 'production';
  }

  private isDevAuthMockCode(code: string): boolean {
    return this.isDevAuthMockEnabled() && code === DEV_LOGIN_CODE;
  }
}
