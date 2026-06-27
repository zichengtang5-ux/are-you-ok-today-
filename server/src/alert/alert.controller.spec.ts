import { Test, TestingModule } from '@nestjs/testing';
import { AlertController } from './alert.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('AlertController', () => {
  let controller: AlertController;
  const mockPrisma = {
    alertEvent: {
      findFirst: jest.fn(),
    },
    emergencyContact: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = mod.get(AlertController);
    jest.clearAllMocks();
  });

  describe('getActiveAlert', () => {
    it('should return null when no active alert', async () => {
      mockPrisma.alertEvent.findFirst.mockResolvedValue(null);

      const result = await controller.getActiveAlert('u1');
      expect(result).toBeNull();
    });

    it('should return alert with masked contacts and timeline', async () => {
      mockPrisma.alertEvent.findFirst.mockResolvedValue({
        id: 'a1',
        triggeredAt: new Date('2026-06-25T22:30:00Z'),
        contactsNotified: '["c1"]',
        timeline: '[{"time":"22:00","action":"发送了每日提醒"},{"time":"22:30","action":"通知了紧急联系人","isCurrent":true}]',
        guardStatus: { lastReplyAt: new Date('2026-06-24T20:15:00Z') },
      });
      mockPrisma.emergencyContact.findMany.mockResolvedValue([
        { id: 'c1', name: '妈妈', phone: '13812345678' },
        { id: 'c2', name: '爸爸', phone: '13987654321' },
      ]);

      const result = await controller.getActiveAlert('u1');

      expect(result.id).toBe('a1');
      expect(result.triggeredAt).toBe('2026-06-25T22:30:00.000Z');
      expect(result.lastReplyAt).toBe('2026-06-24T20:15:00.000Z');
      expect(result.contactsNotified).toHaveLength(1);
      expect(result.contactsNotified[0].name).toBe('妈妈');
      expect(result.contactsNotified[0].phone).toBe('138****5678');
      expect(result.timeline).toHaveLength(2);
      expect(result.timeline[1].isCurrent).toBe(true);
    });

    it('should handle empty contactsNotified and timeline', async () => {
      mockPrisma.alertEvent.findFirst.mockResolvedValue({
        id: 'a2',
        triggeredAt: new Date('2026-06-25T23:00:00Z'),
        contactsNotified: '[]',
        timeline: '[]',
        guardStatus: { lastReplyAt: null },
      });
      mockPrisma.emergencyContact.findMany.mockResolvedValue([]);

      const result = await controller.getActiveAlert('u1');

      expect(result.contactsNotified).toHaveLength(0);
      expect(result.timeline).toHaveLength(0);
      expect(result.lastReplyAt).toBeNull();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockPrisma.alertEvent.findFirst.mockResolvedValue({
        id: 'a3',
        triggeredAt: new Date('2026-06-25T23:00:00Z'),
        contactsNotified: 'invalid-json',
        timeline: 'also-invalid',
        guardStatus: { lastReplyAt: null },
      });
      mockPrisma.emergencyContact.findMany.mockResolvedValue([]);

      const result = await controller.getActiveAlert('u1');

      expect(result.contactsNotified).toHaveLength(0);
      expect(result.timeline).toHaveLength(0);
    });
  });
});
