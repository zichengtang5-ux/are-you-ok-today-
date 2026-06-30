import { Test, TestingModule } from '@nestjs/testing';
import { ReplyService } from './reply.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('ReplyService', () => {
  let service: ReplyService;
  const mockPrisma = {
    dailyRecord: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    guardStatus: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    alertEvent: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    reminderConfig: {
      findUnique: jest.fn(),
    },
    pauseLog: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ReplyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = mod.get(ReplyService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('replyToday', () => {
    it('should create reply record and update guard status', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({ status: 'idle' });
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRecord.upsert.mockResolvedValue({ status: 'replied' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'replied' });
      mockPrisma.alertEvent.findFirst.mockResolvedValue(null);

      const result = await service.replyToday('u1');
      expect(result.message).toBe('收到，安心了');
      expect(result.alertResolved).toBe(false);
    });

    it('should reject if already replied today', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({ status: 'replied' });
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'replied' });

      await expect(service.replyToday('u1')).rejects.toThrow(BadRequestException);
    });

    it('should resolve active alert on reply', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({ status: 'grace' });
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRecord.upsert.mockResolvedValue({ status: 'replied' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'replied' });
      mockPrisma.alertEvent.findFirst.mockResolvedValue({ id: 'a1', status: 'active' });
      mockPrisma.alertEvent.update.mockResolvedValue({});

      const result = await service.replyToday('u1');
      expect(result.alertResolved).toBe(true);
      expect(mockPrisma.alertEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1' } }),
      );
    });

    it('should return 409 when user is paused', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({ status: 'paused' });
      mockPrisma.pauseLog.findFirst.mockResolvedValue({
        id: 'p1',
        endTime: new Date(Date.now() + 86400000),
        isActive: true,
      });

      await expect(service.replyToday('u1')).rejects.toThrow(ConflictException);
    });

    it('should auto-expire pause and allow reply when pause has ended', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({ status: 'paused' });
      mockPrisma.pauseLog.findFirst.mockResolvedValue({
        id: 'p1',
        endTime: new Date(Date.now() - 1000),
        isActive: true,
      });
      mockPrisma.pauseLog.update.mockResolvedValue({});
      mockPrisma.guardStatus.update.mockResolvedValue({});
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRecord.upsert.mockResolvedValue({ status: 'replied' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'replied' });
      mockPrisma.alertEvent.findFirst.mockResolvedValue(null);

      const result = await service.replyToday('u1');
      expect(result.message).toBe('收到，安心了');
      expect(mockPrisma.pauseLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: { isActive: false },
        }),
      );
    });
  });

  describe('undoReply', () => {
    it('should undo reply and reset to waiting when before window end', async () => {
      // 固定到上海时间 12:00（UTC 04:00），endTime 22:00 → 仍在窗口内
      jest.useFakeTimers().setSystemTime(new Date('2026-06-30T04:00:00Z'));
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({ id: 'dr1', status: 'replied' });
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        startTime: '20:00',
        endTime: '22:00',
      });
      mockPrisma.dailyRecord.update.mockResolvedValue({});
      mockPrisma.guardStatus.update.mockResolvedValue({});

      const result = await service.undoReply('u1');
      expect(result.guardStatus).toBe('waiting');
    });

    it('should undo reply and set to grace when after window end', async () => {
      // 固定到上海时间 12:00（UTC 04:00），endTime 02:00 → 已过窗口
      jest.useFakeTimers().setSystemTime(new Date('2026-06-30T04:00:00Z'));
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({ id: 'dr1', status: 'replied' });
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        startTime: '01:00',
        endTime: '02:00',
      });
      mockPrisma.dailyRecord.update.mockResolvedValue({});
      mockPrisma.guardStatus.update.mockResolvedValue({});
      mockPrisma.guardStatus.findUnique.mockResolvedValue({ id: 'gs1' });
      mockPrisma.alertEvent.findFirst.mockResolvedValue(null);
      mockPrisma.alertEvent.create.mockResolvedValue({});

      const result = await service.undoReply('u1');
      expect(result.guardStatus).toBe('grace');
      expect(mockPrisma.alertEvent.create).toHaveBeenCalled();
    });

    it('should not create new alert if one already active', async () => {
      // 固定到上海时间 12:00（UTC 04:00），endTime 02:00 → 已过窗口 → grace
      jest.useFakeTimers().setSystemTime(new Date('2026-06-30T04:00:00Z'));
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({ id: 'dr1', status: 'replied' });
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        startTime: '01:00',
        endTime: '02:00',
      });
      mockPrisma.dailyRecord.update.mockResolvedValue({});
      mockPrisma.guardStatus.update.mockResolvedValue({});
      mockPrisma.guardStatus.findUnique.mockResolvedValue({ id: 'gs1' });
      mockPrisma.alertEvent.findFirst.mockResolvedValue({ id: 'a1', status: 'active' });

      const result = await service.undoReply('u1');
      expect(result.guardStatus).toBe('grace');
      expect(mockPrisma.alertEvent.create).not.toHaveBeenCalled();
    });

    it('should reject if not replied today', async () => {
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);

      await expect(service.undoReply('u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatus', () => {
    it('should return idle status for new user', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
      mockPrisma.reminderConfig.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRecord.findMany.mockResolvedValue([]);

      const result = await service.getStatus('u1');
      expect(result.status).toBe('idle');
      expect(result.todayReplied).toBe(false);
      expect(result.monthlyStats.repliedDays).toBe(0);
    });

    it('should return replied status with monthly stats', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({
        status: 'replied',
        lastReplyAt: new Date('2026-06-24T12:00:00Z'),
      });
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({
        status: 'replied',
        repliedAt: new Date('2026-06-24T12:00:00Z'),
      });
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        startTime: '20:00',
        endTime: '22:00',
      });
      mockPrisma.dailyRecord.findMany.mockResolvedValue([
        { date: '2026-06-23', status: 'replied' },
        { date: '2026-06-24', status: 'replied' },
      ]);

      const result = await service.getStatus('u1');
      expect(result.status).toBe('replied');
      expect(result.todayReplied).toBe(true);
      expect(result.monthlyStats.repliedDays).toBe(2);
    });

    it('should auto-expire paused status when pause has ended', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({
        status: 'paused',
        lastReplyAt: null,
      });
      mockPrisma.pauseLog.findFirst.mockResolvedValue({
        id: 'p1',
        endTime: new Date(Date.now() - 1000),
        isActive: true,
      });
      mockPrisma.pauseLog.update.mockResolvedValue({});
      mockPrisma.guardStatus.update.mockResolvedValue({});
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
      mockPrisma.reminderConfig.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRecord.findMany.mockResolvedValue([]);

      const result = await service.getStatus('u1');
      expect(result.status).toBe('idle');
      expect(mockPrisma.pauseLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: { isActive: false },
        }),
      );
    });

    it('should keep paused status when pause has not ended', async () => {
      mockPrisma.guardStatus.findUnique.mockResolvedValue({
        status: 'paused',
        lastReplyAt: null,
      });
      mockPrisma.pauseLog.findFirst.mockResolvedValue({
        id: 'p1',
        endTime: new Date(Date.now() + 86400000),
        isActive: true,
      });
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
      mockPrisma.reminderConfig.findUnique.mockResolvedValue(null);
      mockPrisma.dailyRecord.findMany.mockResolvedValue([]);

      const result = await service.getStatus('u1');
      expect(result.status).toBe('paused');
    });
  });
});
