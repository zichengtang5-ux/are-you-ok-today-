import { Test, TestingModule } from '@nestjs/testing';
import { ReminderService } from './reminder.service';
import { PrismaService } from '../prisma/prisma.service';

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
      expect(mockPrisma.reminderConfig.create).toHaveBeenCalledWith({ data: { userId: 'u1' } });
    });
  });

  describe('updateConfig', () => {
    it('should update start time', async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.reminderConfig.update.mockResolvedValue({ startTime: '19:00' });

      const result = await service.updateConfig('u1', { startTime: '19:00' });
      expect(result.startTime).toBe('19:00');
    });
  });
});
