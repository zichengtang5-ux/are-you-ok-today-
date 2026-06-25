import { Test, TestingModule } from '@nestjs/testing';
import { GuardianService } from './guardian.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReplyService } from '../alert/reply.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('GuardianService', () => {
  let service: GuardianService;
  const mockPrisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    guardianRelation: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscription: { findUnique: jest.fn() },
    reminderConfig: { findUnique: jest.fn() },
    dailyRecord: { findMany: jest.fn() },
    alertEvent: { findMany: jest.fn() },
    guardStatus: { findUnique: jest.fn() },
  };
  const mockReply = {
    replyToday: jest.fn(),
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        GuardianService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReplyService, useValue: mockReply },
      ],
    }).compile();

    service = mod.get(GuardianService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create guardian relation with invite code', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'g1', phone: '13900001111' }) // guardian
        .mockResolvedValueOnce({ id: 'w1', phone: '13800002222' }); // ward lookup
      mockPrisma.guardianRelation.count.mockResolvedValue(0);
      mockPrisma.guardianRelation.findUnique.mockResolvedValue(null);
      mockPrisma.guardianRelation.create.mockResolvedValue({
        id: 'gr1',
        inviteCode: 'ABC12345',
        guardianId: 'g1',
        wardId: 'w1',
      });

      const result = await service.create('g1', '妈妈', '13800002222', '子女');

      expect(result.id).toBe('gr1');
      expect(result.inviteCode).toBe('ABC12345');
      expect(result.inviteLink).toContain('todayok://invite/');
      expect(result.isBound).toBe(false);
      expect(result.wardName).toBe('妈妈');
      expect(result.wardPhone).toBe('13800002222');
    });

    it('should reject when wardPhone equals user phone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'g1', phone: '13800001111' });

      await expect(service.create('g1', '自己', '13800001111', '子女')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when guardian limit exceeded', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'g1', phone: '13900001111' });
      mockPrisma.guardianRelation.count.mockResolvedValue(5);

      await expect(service.create('g1', '妈妈', '13800002222', '子女')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create ward user if not exists', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'g1', phone: '13900001111' }) // guardian
        .mockResolvedValueOnce(null); // ward not found
      mockPrisma.user.create.mockResolvedValue({ id: 'w-new', phone: '13800009999' });
      mockPrisma.guardianRelation.count.mockResolvedValue(0);
      mockPrisma.guardianRelation.findUnique.mockResolvedValue(null);
      mockPrisma.guardianRelation.create.mockResolvedValue({
        id: 'gr2',
        inviteCode: 'XYZ12345',
      });

      const result = await service.create('g1', '爸爸', '13800009999', '子女');

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '13800009999' }),
        }),
      );
    });

    it('should reject duplicate guardian relation', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'g1', phone: '13900001111' })
        .mockResolvedValueOnce({ id: 'w1', phone: '13800002222' });
      mockPrisma.guardianRelation.count.mockResolvedValue(0);
      mockPrisma.guardianRelation.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create('g1', '妈妈', '13800002222', '子女')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('acceptInvite', () => {
    it('should accept invite and bind ward', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue({
        id: 'gr1',
        isBound: false,
        guardian: { id: 'g1', nickname: '小张' },
      });
      mockPrisma.guardianRelation.update.mockResolvedValue({});

      const result = await service.acceptInvite('w1', 'abc12345');

      expect(result.message).toBe('绑定成功');
      expect(result.guardian.guardianName).toBe('小张');
      expect(mockPrisma.guardianRelation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ wardId: 'w1', isBound: true }),
        }),
      );
    });

    it('should handle case-insensitive invite code', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue({
        id: 'gr1',
        isBound: false,
        guardian: { id: 'g1', nickname: '小张' },
      });
      mockPrisma.guardianRelation.update.mockResolvedValue({});

      await service.acceptInvite('w1', 'abc12345');

      expect(mockPrisma.guardianRelation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inviteCode: 'ABC12345' },
        }),
      );
    });

    it('should reject invalid invite code', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue(null);

      await expect(service.acceptInvite('w1', 'INVALID')).rejects.toThrow(NotFoundException);
    });

    it('should reject already used invite', async () => {
      mockPrisma.guardianRelation.findFirst.mockResolvedValue({
        id: 'gr1',
        isBound: true,
        guardian: { id: 'g1', nickname: '小张' },
      });

      await expect(service.acceptInvite('w1', 'ABC12345')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWards', () => {
    it('should return all wards including unbound', async () => {
      mockPrisma.guardianRelation.findMany.mockResolvedValue([
        {
          id: 'gr1',
          relation: '子女',
          isBound: true,
          ward: {
            id: 'w1',
            nickname: '妈妈',
            phone: '13800002222',
            guardStatus: { status: 'replied', lastReplyAt: new Date('2026-06-25T12:00:00Z') },
            reminderConfig: { startTime: '19:00', endTime: '21:00' },
          },
        },
        {
          id: 'gr2',
          relation: '子女',
          isBound: false,
          ward: {
            id: 'w2',
            nickname: null,
            phone: '13800003333',
            guardStatus: null,
            reminderConfig: null,
          },
        },
      ]);

      const result = await service.getWards('g1');

      expect(result).toHaveLength(2);
      expect(result[0].wardName).toBe('妈妈');
      expect(result[0].isBound).toBe(true);
      expect(result[0].wardPhone).toBe('138****2222');
      expect(result[1].isBound).toBe(false);
      expect(result[1].status).toBe('idle');
    });
  });

  describe('getDashboard', () => {
    it('should return limited data for free users', async () => {
      mockPrisma.guardianRelation.findUnique.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g1',
        ward: {
          id: 'w1',
          nickname: '妈妈',
          phone: '13800002222',
          guardStatus: { status: 'replied', lastReplyAt: new Date('2026-06-25T12:00:00Z') },
          reminderConfig: { timezone: 'Asia/Shanghai' },
          subscription: null,
        },
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'g1' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'free' });

      const result = await service.getDashboard('g1', 'gr1');

      expect(result.wardName).toBe('妈妈');
      expect(result.status).toBe('replied');
      expect(result.recentDays).toBeNull();
      expect(result.monthlyStats).toBeNull();
      expect(result.history).toBeNull();
      expect(result.isPremium).toBe(false);
    });

    it('should return full data for premium users', async () => {
      mockPrisma.guardianRelation.findUnique.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g1',
        ward: {
          id: 'w1',
          nickname: '妈妈',
          phone: '13800002222',
          guardStatus: { status: 'replied', lastReplyAt: new Date('2026-06-25T12:00:00Z') },
          reminderConfig: { timezone: 'Asia/Shanghai' },
          subscription: null,
        },
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'g1' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active' });
      mockPrisma.dailyRecord.findMany.mockResolvedValue([
        { date: '2026-06-25', status: 'replied' },
        { date: '2026-06-24', status: 'replied' },
      ]);
      mockPrisma.alertEvent.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('g1', 'gr1');

      expect(result.isPremium).toBe(true);
      expect(result.recentDays).not.toBeNull();
      expect(result.monthlyStats).not.toBeNull();
      expect(result.monthlyStats!.repliedDays).toBe(2);
    });

    it('should reject unauthorized access', async () => {
      mockPrisma.guardianRelation.findUnique.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g-other',
        ward: { id: 'w1', nickname: '妈妈', phone: '138', guardStatus: null, reminderConfig: null, subscription: null },
      });

      await expect(service.getDashboard('g1', 'gr1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('proxyReply', () => {
    it('should proxy reply for ward', async () => {
      mockPrisma.guardianRelation.findUnique.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g1',
        wardId: 'w1',
      });
      mockReply.replyToday.mockResolvedValue({
        message: '收到，安心了',
        guardStatus: 'replied',
      });

      const result = await service.proxyReply('g1', 'gr1');

      expect(result.message).toBe('已代确认');
      expect(result.guardStatus).toBe('replied');
      expect(mockReply.replyToday).toHaveBeenCalledWith('w1');
    });

    it('should be idempotent when already replied', async () => {
      mockPrisma.guardianRelation.findUnique.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g1',
        wardId: 'w1',
      });
      mockReply.replyToday.mockRejectedValue(new BadRequestException('今天已回复'));

      const result = await service.proxyReply('g1', 'gr1');

      expect(result.message).toBe('已代确认');
      expect(result.guardStatus).toBe('replied');
    });

    it('should reject unauthorized guardian', async () => {
      mockPrisma.guardianRelation.findUnique.mockResolvedValue({
        id: 'gr1',
        guardianId: 'g-other',
        wardId: 'w1',
      });

      await expect(service.proxyReply('g1', 'gr1')).rejects.toThrow(ForbiddenException);
    });
  });
});
