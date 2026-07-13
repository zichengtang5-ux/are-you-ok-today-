import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Status } from '@apple/app-store-server-library';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  const mockPrisma = {
    subscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
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
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
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

    it('should reject a subscription already bound to another account', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({ userId: 'u2' });

      await expect(service.verify('u1', 'txn-used', 'monthly')).rejects.toThrow(
        '该 Apple 订阅已绑定其他账号',
      );
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
    beforeEach(() => {
      mockConfig.get.mockImplementation((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'staging',
          APNS_BUNDLE_ID: 'com.todayok.app',
          APPLE_IAP_MONTHLY_PRODUCT_ID: 'com.todayok.subscription.monthly',
          APPLE_IAP_YEARLY_PRODUCT_ID: 'com.todayok.subscription.yearly',
        };
        return map[key] ?? defaultVal;
      });
    });

    it('should reject when the App Store API fails', async () => {
      jest.spyOn(service as any, 'createAppleClients').mockReturnValue({
        client: { getAllSubscriptionStatuses: jest.fn().mockRejectedValue(new Error('401')) },
        verifier: {},
        bundleId: 'com.todayok.app',
      });

      await expect(service.verify('u1', 'txn-real', 'monthly')).rejects.toThrow(BadRequestException);
    });

    it('should accept a verified active transaction and use Apple expiry', async () => {
      const expiresDate = Date.now() + 30 * 86400000;
      jest.spyOn(service as any, 'createAppleClients').mockReturnValue({
        client: {
          getAllSubscriptionStatuses: jest.fn().mockResolvedValue({
            bundleId: 'com.todayok.app',
            data: [{ lastTransactions: [{ status: Status.ACTIVE, signedTransactionInfo: 'jws' }] }],
          }),
        },
        verifier: {
          verifyAndDecodeTransaction: jest.fn().mockResolvedValue({
            productId: 'com.todayok.subscription.monthly',
            bundleId: 'com.todayok.app',
            transactionId: 'txn-active',
            originalTransactionId: 'original-active',
            expiresDate,
          }),
        },
        bundleId: 'com.todayok.app',
      });
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        plan: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(expiresDate),
        appleTransactionId: 'txn-active',
      });

      const result = await service.verify('u1', 'txn-active', 'monthly');
      expect(result.subscription.status).toBe('active');
      expect(result.subscription.originalTransactionId).toBe('original-active');
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            currentPeriodEnd: new Date(expiresDate),
            appleOriginalTransactionId: 'original-active',
          }),
        }),
      );
    });

    it('should reject an active transaction for the wrong product', async () => {
      jest.spyOn(service as any, 'createAppleClients').mockReturnValue({
        client: {
          getAllSubscriptionStatuses: jest.fn().mockResolvedValue({
            bundleId: 'com.todayok.app',
            data: [{ lastTransactions: [{ status: Status.ACTIVE, signedTransactionInfo: 'jws' }] }],
          }),
        },
        verifier: {
          verifyAndDecodeTransaction: jest.fn().mockResolvedValue({
            productId: 'com.todayok.subscription.yearly',
            bundleId: 'com.todayok.app',
            transactionId: 'txn-wrong-plan',
            originalTransactionId: 'original-wrong-plan',
            expiresDate: Date.now() + 86400000,
          }),
        },
        bundleId: 'com.todayok.app',
      });

      await expect(service.verify('u1', 'txn-wrong-plan', 'monthly')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject an expired transaction', async () => {
      jest.spyOn(service as any, 'createAppleClients').mockReturnValue({
        client: {
          getAllSubscriptionStatuses: jest.fn().mockResolvedValue({
            bundleId: 'com.todayok.app',
            data: [{ lastTransactions: [{ status: Status.ACTIVE, signedTransactionInfo: 'jws' }] }],
          }),
        },
        verifier: {
          verifyAndDecodeTransaction: jest.fn().mockResolvedValue({
            productId: 'com.todayok.subscription.monthly',
            bundleId: 'com.todayok.app',
            transactionId: 'txn-expired',
            originalTransactionId: 'original-expired',
            expiresDate: Date.now() - 1000,
          }),
        },
        bundleId: 'com.todayok.app',
      });

      await expect(service.verify('u1', 'txn-expired', 'monthly')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
