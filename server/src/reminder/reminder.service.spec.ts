import { Test, TestingModule } from '@nestjs/testing';
import { ReminderService } from './reminder.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('ReminderService', () => {
  let service: ReminderService;
  const mockPrisma = {
    reminderConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = mod.get(ReminderService);
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return existing config', async () => {
      const config = { userId: 'u1', startTime: '20:00', endTime: '22:00' };
      mockPrisma.reminderConfig.findUnique.mockResolvedValue(config);

      const result = await service.getConfig('u1');
      expect(result).toEqual(config);
      expect(mockPrisma.reminderConfig.create).not.toHaveBeenCalled();
    });

    it('should create default config if not exists', async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue(null);
      mockPrisma.reminderConfig.create.mockResolvedValue({
        userId: 'u1',
        startTime: '20:00',
        endTime: '22:00',
        gracePeriodMin: 30,
      });

      const result = await service.getConfig('u1');
      expect(result.startTime).toBe('20:00');
      expect(mockPrisma.reminderConfig.create).toHaveBeenCalledWith({
        data: { userId: 'u1', nextDueAt: expect.any(Date) },
      });
    });
  });

  describe('updateConfig', () => {
    it('should update start time without recomputing nextDueAt', async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        userId: 'u1',
        startTime: '20:00',
        endTime: '22:00',
        timezone: 'Asia/Shanghai',
      });
      mockPrisma.reminderConfig.update.mockResolvedValue({ startTime: '19:00' });

      const result = await service.updateConfig('u1', { startTime: '19:00' });
      expect(result.startTime).toBe('19:00');
      expect(mockPrisma.reminderConfig.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { startTime: '19:00' },
      });
    });

    it('should recompute nextDueAt when endTime changes', async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        userId: 'u1',
        startTime: '20:00',
        endTime: '22:00',
        timezone: 'Asia/Shanghai',
      });
      mockPrisma.reminderConfig.update.mockResolvedValue({ endTime: '21:00' });

      await service.updateConfig('u1', { endTime: '21:00' });
      expect(mockPrisma.reminderConfig.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { endTime: '21:00', nextDueAt: expect.any(Date) },
      });
    });

    it('should accept an overnight reminder window', async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        userId: 'u1',
        startTime: '20:00',
        endTime: '22:00',
        timezone: 'Asia/Shanghai',
      });
      mockPrisma.reminderConfig.update.mockResolvedValue({
        startTime: '23:00',
        endTime: '01:00',
      });

      await expect(
        service.updateConfig('u1', { startTime: '23:00', endTime: '01:00' }),
      ).resolves.toEqual(expect.objectContaining({ endTime: '01:00' }));
    });

    it('should reject invalid or identical reminder times', async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        userId: 'u1',
        startTime: '20:00',
        endTime: '22:00',
        timezone: 'Asia/Shanghai',
      });

      await expect(service.updateConfig('u1', { startTime: '24:00' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateConfig('u1', { startTime: '22:00' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
