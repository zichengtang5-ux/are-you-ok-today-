import { Test, TestingModule } from '@nestjs/testing';
import { PauseService } from './pause.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('PauseService', () => {
  let service: PauseService;
  const mockPrisma: any = {
    pauseLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    guardStatus: {
      upsert: jest.fn(),
    },
    reminderConfig: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (arg: unknown): Promise<unknown> => {
      if (typeof arg === 'function') return (arg as (tx: any) => unknown)(mockPrisma);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        PauseService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = mod.get(PauseService);
    jest.clearAllMocks();
  });

  describe('pause', () => {
    it('should create pause log and set guard status to paused', async () => {
      mockPrisma.pauseLog.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.pauseLog.create.mockResolvedValue({ id: 'pl1' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'paused' });

      const result = await service.pause('u1', 7, '出差');

      expect(result.message).toBe('守护已暂停');
      expect(result.days).toBe(7);
      expect(result.pauseEndAt).toBeDefined();
      expect(mockPrisma.pauseLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            reason: '出差',
            isActive: true,
          }),
        }),
      );
      expect(mockPrisma.guardStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { status: 'paused' },
        }),
      );
    });

    it('should move the next reminder past the pause period', async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        endTime: '22:00',
        timezone: 'Asia/Shanghai',
      });
      mockPrisma.pauseLog.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.pauseLog.create.mockResolvedValue({ id: 'pl1' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'paused' });

      await service.pause('u1', 3);

      expect(mockPrisma.reminderConfig.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { nextDueAt: expect.any(Date) },
      });
    });

    it('should deactivate existing active pauses before creating new one', async () => {
      mockPrisma.pauseLog.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.pauseLog.create.mockResolvedValue({ id: 'pl2' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({});

      await service.pause('u1', 3);

      expect(mockPrisma.pauseLog.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', isActive: true },
        data: { isActive: false },
      });
    });

    it('should handle pause without reason', async () => {
      mockPrisma.pauseLog.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.pauseLog.create.mockResolvedValue({ id: 'pl3' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({});

      const result = await service.pause('u1', 1);

      expect(result.days).toBe(1);
      expect(mockPrisma.pauseLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: null }),
        }),
      );
    });

    it('should reject pauses longer than 14 days', async () => {
      await expect(service.pause('u1', 15)).rejects.toThrow('暂停时长需为 1 至 14 天');
      expect(mockPrisma.pauseLog.create).not.toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('should resume guard and set status to idle', async () => {
      mockPrisma.pauseLog.findFirst.mockResolvedValue({ id: 'pl1', isActive: true });
      mockPrisma.pauseLog.update.mockResolvedValue({});
      mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'idle' });
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        endTime: '22:00',
        timezone: 'Asia/Shanghai',
      });

      const result = await service.resume('u1');

      expect(result.message).toBe('守护已恢复');
      expect(result.guardStatus).toBe('idle');
      expect(mockPrisma.pauseLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pl1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(mockPrisma.reminderConfig.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { nextDueAt: expect.any(Date) },
      });
    });

    it('should throw when no active pause', async () => {
      mockPrisma.pauseLog.findFirst.mockResolvedValue(null);

      await expect(service.resume('u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatus', () => {
    it('should return not paused when no active pause', async () => {
      mockPrisma.pauseLog.findFirst.mockResolvedValue(null);

      const result = await service.getStatus('u1');

      expect(result).toEqual({ isPaused: false });
    });

    it('should return paused with days remaining', async () => {
      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 5);
      mockPrisma.pauseLog.findFirst.mockResolvedValue({
        id: 'pl1',
        endTime: futureEnd,
        reason: '出差',
        isActive: true,
      });

      const result = await service.getStatus('u1');

      expect(result.isPaused).toBe(true);
      expect(result.daysRemaining).toBe(5);
      expect(result.reason).toBe('出差');
      expect(result.pauseEndAt).toBeDefined();
    });

    it('should auto-expire pause when end time passed', async () => {
      const pastEnd = new Date();
      pastEnd.setDate(pastEnd.getDate() - 1);
      mockPrisma.pauseLog.findFirst.mockResolvedValue({
        id: 'pl1',
        endTime: pastEnd,
        isActive: true,
      });
      mockPrisma.pauseLog.update.mockResolvedValue({});
      mockPrisma.guardStatus.upsert.mockResolvedValue({});

      const result = await service.getStatus('u1');

      expect(result).toEqual({ isPaused: false });
      expect(mockPrisma.pauseLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(mockPrisma.guardStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { status: 'idle' } }),
      );
    });
  });
});
