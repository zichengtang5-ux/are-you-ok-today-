import { Test, TestingModule } from '@nestjs/testing';
import { ReminderCronService } from './reminder-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';

describe('ReminderCronService', () => {
  let service: ReminderCronService;
  const mockPrisma = {
    reminderConfig: { findMany: jest.fn() },
    dailyRecord: { findUnique: jest.fn(), upsert: jest.fn() },
    guardStatus: { upsert: jest.fn() },
    alertEvent: { findFirst: jest.fn(), create: jest.fn() },
    notificationLog: { create: jest.fn() },
  };
  const mockPush = {
    sendCareReminder: jest.fn().mockResolvedValue(true),
    sendAlertNotification: jest.fn().mockResolvedValue(true),
  };
  const mockSms = {
    sendAlertSms: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
        { provide: SmsService, useValue: mockSms },
      ],
    }).compile();

    service = mod.get(ReminderCronService);
    jest.clearAllMocks();
  });

  describe('checkReminders', () => {
    it('should skip user who already replied', async () => {
      mockPrisma.reminderConfig.findMany.mockResolvedValue([
        {
          id: 'rc1',
          userId: 'u1',
          startTime: '20:00',
          endTime: '20:00',
          gracePeriodMin: 30,
          timezone: 'Asia/Shanghai',
          user: {
            id: 'u1',
            isOnboarded: true,
            nickname: '小李',
            devices: [{ token: 'tok1' }],
            contacts: [],
            pauseLogs: [],
            guardStatus: { id: 'gs1', status: 'waiting', lastReplyAt: null },
          },
        },
      ]);
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'replied' });

      await service.checkReminders();
      expect(mockPush.sendCareReminder).not.toHaveBeenCalled();
    });

    it('should skip non-onboarded user', async () => {
      mockPrisma.reminderConfig.findMany.mockResolvedValue([
        {
          id: 'rc1',
          userId: 'u1',
          startTime: '20:00',
          endTime: '20:00',
          gracePeriodMin: 30,
          timezone: 'Asia/Shanghai',
          user: {
            id: 'u1',
            isOnboarded: false,
            nickname: null,
            devices: [],
            contacts: [],
            pauseLogs: [],
            guardStatus: null,
          },
        },
      ]);

      await service.checkReminders();
      expect(mockPush.sendCareReminder).not.toHaveBeenCalled();
    });

    it('should skip user with active pause', async () => {
      const futureEnd = new Date(Date.now() + 86400000);
      mockPrisma.reminderConfig.findMany.mockResolvedValue([
        {
          id: 'rc1',
          userId: 'u1',
          startTime: '20:00',
          endTime: '20:00',
          gracePeriodMin: 30,
          timezone: 'Asia/Shanghai',
          user: {
            id: 'u1',
            isOnboarded: true,
            nickname: '小李',
            devices: [{ token: 'tok1' }],
            contacts: [],
            pauseLogs: [{ isActive: true, endTime: futureEnd }],
            guardStatus: { id: 'gs1', status: 'waiting', lastReplyAt: null },
          },
        },
      ]);

      await service.checkReminders();
      expect(mockPush.sendCareReminder).not.toHaveBeenCalled();
    });

    it('should send care reminder when window ended and user not replied', async () => {
      mockPrisma.reminderConfig.findMany.mockResolvedValue([
        {
          id: 'rc1',
          userId: 'u1',
          startTime: '01:00',
          endTime: '02:00',
          gracePeriodMin: 30,
          timezone: 'Asia/Shanghai',
          user: {
            id: 'u1',
            isOnboarded: true,
            nickname: '小李',
            devices: [{ token: 'tok1' }],
            contacts: [],
            pauseLogs: [],
            guardStatus: { id: 'gs1', status: 'waiting', lastReplyAt: null },
          },
        },
      ]);
      mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
      mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'grace' });
      mockPrisma.dailyRecord.upsert.mockResolvedValue({});

      await service.checkReminders();
      expect(mockPush.sendCareReminder).toHaveBeenCalledWith('tok1', '小李');
      expect(mockPrisma.guardStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { status: 'grace' } }),
      );
    });

    it('should trigger alert when grace period expired', async () => {
      mockPrisma.reminderConfig.findMany.mockResolvedValue([
        {
          id: 'rc1',
          userId: 'u1',
          startTime: '01:00',
          endTime: '02:00',
          gracePeriodMin: 30,
          timezone: 'Asia/Shanghai',
          user: {
            id: 'u1',
            isOnboarded: true,
            nickname: '小李',
            devices: [],
            contacts: [{ id: 'c1', name: '妈妈', phone: '13800001111' }],
            pauseLogs: [],
            guardStatus: { id: 'gs1', status: 'grace', lastReplyAt: null },
          },
        },
      ]);
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'grace' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({ id: 'gs1', status: 'alert' });
      mockPrisma.dailyRecord.upsert.mockResolvedValue({});
      mockPrisma.alertEvent.findFirst.mockResolvedValue(null);
      mockPrisma.alertEvent.create.mockResolvedValue({});
      mockPrisma.notificationLog.create.mockResolvedValue({});

      await service.checkReminders();
      expect(mockSms.sendAlertSms).toHaveBeenCalledWith(
        '13800001111',
        expect.stringContaining('小李'),
      );
      expect(mockPrisma.alertEvent.create).toHaveBeenCalled();
      expect(mockPrisma.notificationLog.create).toHaveBeenCalled();
    });

    it('should not create duplicate active alert', async () => {
      mockPrisma.reminderConfig.findMany.mockResolvedValue([
        {
          id: 'rc1',
          userId: 'u1',
          startTime: '01:00',
          endTime: '02:00',
          gracePeriodMin: 30,
          timezone: 'Asia/Shanghai',
          user: {
            id: 'u1',
            isOnboarded: true,
            nickname: '小李',
            devices: [],
            contacts: [{ id: 'c1', name: '妈妈', phone: '13800001111' }],
            pauseLogs: [],
            guardStatus: { id: 'gs1', status: 'grace', lastReplyAt: null },
          },
        },
      ]);
      mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'grace' });
      mockPrisma.guardStatus.upsert.mockResolvedValue({ id: 'gs1', status: 'alert' });
      mockPrisma.dailyRecord.upsert.mockResolvedValue({});
      mockPrisma.alertEvent.findFirst.mockResolvedValue({ id: 'ae1', status: 'active' });
      mockPrisma.notificationLog.create.mockResolvedValue({});

      await service.checkReminders();
      expect(mockPrisma.alertEvent.create).not.toHaveBeenCalled();
    });
  });
});
