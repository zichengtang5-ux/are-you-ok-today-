import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    readFileSync: jest.fn(),
  };
});

const actualCrypto = jest.requireActual('crypto');
const testKeyPem: string = actualCrypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
}).privateKey;

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  const mockPrisma = {
    subscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    guardianRelation: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
  const mockConfig = {
    get: jest.fn((key: string, defaultVal?: string) => {
      const map: Record<string, string> = {
        APNS_PROVIDER: 'mock',
        NODE_ENV: 'development',
      };
      return map[key] ?? defaultVal;
    }),
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = mod.get(SubscriptionService);
    jest.clearAllMocks();
  });

  describe('verify', () => {
    it('should create subscription on successful verification', async () => {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: periodEnd,
        appleTransactionId: 'txn-123',
      });

      const result = await service.verify('u1', 'txn-123', 'monthly');

      expect(result.subscription.plan).toBe('monthly');
      expect(result.subscription.status).toBe('active');
      expect(result.subscription.currentPeriodEnd).not.toBeNull();
      expect(result.subscription.originalTransactionId).toBe('txn-123');
      expect(result.subscription.isTrial).toBe(false);
    });

    it('should support yearly plan', async () => {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 365);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        plan: 'yearly',
        status: 'active',
        currentPeriodEnd: periodEnd,
        appleTransactionId: 'txn-456',
      });

      const result = await service.verify('u1', 'txn-456', 'yearly');

      expect(result.subscription.plan).toBe('yearly');
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: 'yearly' }),
        }),
      );
    });

    it('should update existing subscription', async () => {
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        plan: 'yearly',
        status: 'active',
        currentPeriodEnd: new Date(),
        appleTransactionId: 'txn-new',
      });

      const result = await service.verify('u1', 'txn-new', 'yearly');

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          update: expect.objectContaining({ plan: 'yearly', status: 'active' }),
        }),
      );
    });
  });

  describe('proxySubscribe', () => {
    it('should subscribe for ward when guardian is bound', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g1',
        wardId: 'w1',
        isBound: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'w1',
        nickname: '妈妈',
        phone: '13800002222',
      });
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 's2',
        userId: 'w1',
        plan: 'yearly',
        status: 'active',
        currentPeriodEnd: new Date(),
        appleTransactionId: 'txn-proxy',
        paidBy: 'g1',
      });

      const result = await service.proxySubscribe('g1', 'w1', 'txn-proxy', 'yearly');

      expect(result.message).toContain('妈妈');
      expect(result.wardName).toBe('妈妈');
      expect(result.subscription.status).toBe('active');
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ paidBy: 'g1' }),
        }),
      );
    });

    it('should reject when no bound guardian relation', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue(null);

      await expect(
        service.proxySubscribe('g1', 'w1', 'txn-proxy', 'yearly'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when ward does not exist', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g1',
        wardId: 'w1',
        isBound: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.proxySubscribe('g1', 'w1', 'txn-proxy', 'yearly'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use phone as wardName when nickname is null', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g1',
        wardId: 'w1',
        isBound: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'w1',
        nickname: null,
        phone: '13800002222',
      });
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 's2',
        userId: 'w1',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(),
      });

      const result = await service.proxySubscribe('g1', 'w1', 'txn-proxy', 'monthly');

      expect(result.wardName).toBe('13800002222');
      expect(result.message).toContain('13800002222');
    });
  });

  describe('getStatus', () => {
    it('should return free status for user without subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getStatus('u1');

      expect(result).toEqual({
        plan: 'free',
        status: 'inactive',
        currentPeriodEnd: null,
        isPremium: false,
      });
    });

    it('should return active premium status', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 's1',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: futureDate,
      });

      const result = await service.getStatus('u1');

      expect(result.plan).toBe('monthly');
      expect(result.status).toBe('active');
      expect(result.isPremium).toBe(true);
    });

    it('should return trial as premium', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 's1',
        plan: 'monthly',
        status: 'trial',
        currentPeriodEnd: futureDate,
      });

      const result = await service.getStatus('u1');

      expect(result.isPremium).toBe(true);
    });

    it('should auto-expire when period end passed', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 's1',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: pastDate,
      });
      mockPrisma.subscription.update.mockResolvedValue({});

      const result = await service.getStatus('u1');

      expect(result.status).toBe('expired');
      expect(result.isPremium).toBe(false);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'expired' } }),
      );
    });

    it('should return inactive status for cancelled subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 's1',
        plan: 'monthly',
        status: 'cancelled',
        currentPeriodEnd: null,
      });

      const result = await service.getStatus('u1');

      expect(result.isPremium).toBe(false);
      expect(result.status).toBe('cancelled');
    });
  });

  describe('IAP validation (non-development)', () => {
    let fetchSpy: jest.SpyInstance;
    let cryptoSpy: jest.SpyInstance;

    beforeEach(() => {
      mockConfig.get.mockImplementation((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'staging',
          APNS_BUNDLE_ID: 'com.todayok.app',
          APPLE_IAP_ISSUER_ID: 'test-issuer',
          APPLE_IAP_KEY_ID: 'test-key-id',
          APPLE_IAP_KEY_PATH: '/test/key.p8',
        };
        return map[key] ?? defaultVal;
      });

      const fs = require('fs');
      fs.readFileSync.mockReturnValue(testKeyPem);

      const fakeDerSig = Buffer.concat([
        Buffer.from([0x30, 0x44, 0x02, 0x20]),
        Buffer.alloc(32, 0xaa),
        Buffer.from([0x02, 0x20]),
        Buffer.alloc(32, 0xbb),
      ]);

      const mockSigner = {
        update: jest.fn().mockReturnThis(),
        sign: jest.fn().mockReturnValue(fakeDerSig),
      };
      cryptoSpy = jest.spyOn(require('crypto'), 'createSign').mockReturnValue(mockSigner as any);

      (service as any).apiTokenCache = null;
    });

    afterEach(() => {
      if (fetchSpy) fetchSpy.mockRestore();
      if (cryptoSpy) cryptoSpy.mockRestore();
    });

    it('should return false when IAP API returns non-200', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(service.verify('u1', 'txn-real', 'monthly')).rejects.toThrow(BadRequestException);
    });

    it('should return true when subscription status is active (1)', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              lastTransactions: [{ status: 1, signedTransactionInfo: 'signed' }],
            },
          ],
        }),
      } as Response);

      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(),
        appleTransactionId: 'txn-active',
      });

      const result = await service.verify('u1', 'txn-active', 'monthly');
      expect(result.subscription.status).toBe('active');
    });

    it('should return false when subscription status is expired (2)', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              lastTransactions: [{ status: 2, signedTransactionInfo: 'signed' }],
            },
          ],
        }),
      } as Response);

      await expect(service.verify('u1', 'txn-expired', 'monthly')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return false when fetch throws', async () => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(service.verify('u1', 'txn-net-err', 'monthly')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
