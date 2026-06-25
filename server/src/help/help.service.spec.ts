import { Test, TestingModule } from '@nestjs/testing';
import { HelpService } from './help.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

describe('HelpService', () => {
  let service: HelpService;
  const mockPrisma = {
    user: { findUnique: jest.fn() },
    helpRequest: { create: jest.fn() },
    notificationLog: { create: jest.fn() },
  };
  const mockSms = {
    sendAlertSms: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        HelpService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SmsService, useValue: mockSms },
      ],
    }).compile();

    service = mod.get(HelpService);
    jest.clearAllMocks();
  });

  describe('emergency', () => {
    it('should create help request and notify all contacts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        nickname: '小李',
        address: '北京市朝阳区',
        contacts: [
          { id: 'c1', name: '妈妈', phone: '13800001111', priority: 1 },
          { id: 'c2', name: '爸爸', phone: '13800002222', priority: 2 },
        ],
      });
      mockPrisma.helpRequest.create.mockResolvedValue({
        id: 'hr1',
        createdAt: new Date('2026-06-25T23:00:00Z'),
      });
      mockPrisma.notificationLog.create.mockResolvedValue({});

      const result = await service.emergency('u1', 39.9, 116.4, '北京市朝阳区xxx');

      expect(result.id).toBe('hr1');
      expect(result.address).toBe('北京市朝阳区xxx');
      expect(result.contactsNotified).toHaveLength(2);
      expect(result.contactsNotified[0]).toEqual({ id: 'c1', name: '妈妈', phone: '13800001111' });
      expect(mockSms.sendAlertSms).toHaveBeenCalledTimes(2);
      expect(mockPrisma.helpRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            latitude: 39.9,
            longitude: 116.4,
            addressText: '北京市朝阳区xxx',
          }),
        }),
      );
    });

    it('should work without GPS coordinates (address only)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        nickname: '小李',
        address: '预设地址',
        contacts: [{ id: 'c1', name: '妈妈', phone: '13800001111', priority: 1 }],
      });
      mockPrisma.helpRequest.create.mockResolvedValue({
        id: 'hr2',
        createdAt: new Date(),
      });
      mockPrisma.notificationLog.create.mockResolvedValue({});

      const result = await service.emergency('u1', undefined, undefined, 'GPS失败地址');

      expect(result.address).toBe('GPS失败地址');
      expect(mockPrisma.helpRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            latitude: null,
            longitude: null,
            addressText: 'GPS失败地址',
          }),
        }),
      );
    });

    it('should fall back to user address when no addressText provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        nickname: '小李',
        address: '用户预设地址',
        contacts: [],
      });
      mockPrisma.helpRequest.create.mockResolvedValue({
        id: 'hr3',
        createdAt: new Date(),
      });

      const result = await service.emergency('u1', 39.9, 116.4);

      expect(result.address).toBe('用户预设地址');
      expect(result.contactsNotified).toHaveLength(0);
      expect(mockSms.sendAlertSms).not.toHaveBeenCalled();
    });
  });

  describe('getAddress', () => {
    it('should return user preset address', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ address: '北京市朝阳区xxx' });

      const result = await service.getAddress('u1');
      expect(result).toEqual({ address: '北京市朝阳区xxx', source: 'user_preset' });
    });

    it('should return empty address for user without address', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ address: null });

      const result = await service.getAddress('u1');
      expect(result).toEqual({ address: '', source: 'user_preset' });
    });
  });
});
