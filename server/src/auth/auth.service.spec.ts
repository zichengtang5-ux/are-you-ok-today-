import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let sms: any;

  const mockPrisma = {
    verificationCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
    verify: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultVal?: string) => {
      const map: Record<string, string> = {
        SMS_PROVIDER: 'mock',
        JWT_SECRET: 'test-secret',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '30d',
      };
      return map[key] ?? defaultVal;
    }),
  };

  const mockSms = {
    sendVerificationCode: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SmsService, useValue: mockSms },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
    sms = module.get(SmsService);

    jest.clearAllMocks();
  });

  describe('sendCode', () => {
    it('should reject invalid phone number', async () => {
      await expect(service.sendCode('123')).rejects.toThrow(BadRequestException);
    });

    it('should send code and return mock code in mock mode', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue(null);
      mockPrisma.verificationCode.create.mockResolvedValue({});

      const result = await service.sendCode('13812345678');

      expect(result.message).toBe('验证码已发送');
      expect(result.cooldownSeconds).toBe(60);
      expect(result.mockCode).toBeDefined();
      expect(result.mockCode).toMatch(/^\d{6}$/);
      expect(mockSms.sendVerificationCode).toHaveBeenCalled();
    });

    it('should return cooldown when called too frequently', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        code: '123456',
        createdAt: new Date(Date.now() - 30_000), // 30s ago
      });

      const result = await service.sendCode('13812345678');

      expect(result.message).toBe('验证码已发送，请稍后再试');
      expect(result.cooldownSeconds).toBeGreaterThan(0);
      expect(result.cooldownSeconds).toBeLessThanOrEqual(30);
      expect(mockPrisma.verificationCode.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('should reject when code is wrong', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyCode('13812345678', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should create new user and return tokens on valid code', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'vc1',
        phone: '13812345678',
        code: '123456',
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrisma.verificationCode.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user1',
        phone: '13812345678',
        nickname: null,
        isOnboarded: false,
        onboardingStep: 'agreement',
      });

      const result = await service.verifyCode('13812345678', '123456');

      expect(result.user.id).toBe('user1');
      expect(result.user.isOnboarded).toBe(false);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { phone: '13812345678', onboardingStep: 'agreement' },
      });
    });

    it('should login existing user on valid code', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'vc1',
        phone: '13812345678',
        code: '123456',
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrisma.verificationCode.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user1',
        phone: '13812345678',
        nickname: '小李',
        isOnboarded: true,
        onboardingStep: 'complete',
      });

      const result = await service.verifyCode('13812345678', '123456');

      expect(result.user.nickname).toBe('小李');
      expect(result.user.isOnboarded).toBe(true);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should reject invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should reject non-refresh token type', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user1', type: 'access' });

      await expect(service.refresh('access-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should return new tokens for valid refresh token', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user1', type: 'refresh' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1' });

      const result = await service.refresh('valid-refresh');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });
});
