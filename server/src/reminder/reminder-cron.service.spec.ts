import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReminderCronService } from './reminder-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { getLocalDateParts } from './reminder-schedule.util';

/**
 * 返回一个相对"当前上海时间"偏移 deltaMin 分钟的 "HH:mm"。
 * 用于让测试稳定地构造"endTime 已过 / 未到"的场景，避免依赖墙上钟点。
 */
function shanghaiHhmmOffset(deltaMin: number): string {
  const { minutesOfDay } = getLocalDateParts(new Date(), 'Asia/Shanghai');
  let m = (minutesOfDay + deltaMin) % 1440;
  if (m < 0) m += 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

describe('ReminderCronService', () => {
  let service: ReminderCronService;
  const mockPrisma = {
    reminderConfig: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    dailyRecord: { findUnique: jest.fn(), upsert: jest.fn().mockResolvedValue({}) },
    guardStatus: { upsert: jest.fn() },
    alertEvent: { findFirst: jest.fn(), create: jest.fn() },
    notificationLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const mockPush = { sendCareReminder: jest.fn().mockResolvedValue(true) };
  const mockNotificationQueue = { enqueueAlert: jest.fn().mockResolvedValue(undefined) };
  const mockConfig = { get: (key: string, def: unknown) => def };

  function due(config: Record<string, unknown>) {
    // 第一批返回该记录，第二批返回空，结束循环
    mockPrisma.reminderConfig.findMany
      .mockResolvedValueOnce([config])
      .mockResolvedValue([]);
  }

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPush },
        { provide: NotificationQueueService, useValue: mockNotificationQueue },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = mod.get(ReminderCronService);
    jest.clearAllMocks();
    mockPrisma.reminderConfig.update.mockResolvedValue({});
    mockPrisma.dailyRecord.upsert.mockResolvedValue({});
    mockPrisma.notificationLog.create.mockResolvedValue({});
  });

  function baseUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      isOnboarded: true,
      nickname: '小李',
      devices: [{ token: 'tok1' }],
      contacts: [],
      pauseLogs: [],
      guardStatus: { id: 'gs1', status: 'idle', lastReplyAt: null },
      ...overrides,
    };
  }

  function baseConfig(user: Record<string, unknown>, endTime: string) {
    return {
      id: 'rc1',
      userId: 'u1',
      startTime: '00:00',
      endTime,
      gracePeriodMin: 30,
      timezone: 'Asia/Shanghai',
      user,
    };
  }

  it('only scans due records (nextDueAt filter)', async () => {
    due(baseConfig(baseUser(), shanghaiHhmmOffset(60))); // endTime 未到
    mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);

    await service.checkDueReminders();

    expect(mockPrisma.reminderConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nextDueAt: { not: null, lte: expect.any(Date) } },
        orderBy: { nextDueAt: 'asc' },
      }),
    );
  });

  it('should skip user who already replied and advance nextDueAt', async () => {
    due(baseConfig(baseUser(), shanghaiHhmmOffset(-10)));
    mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'replied' });

    await service.checkDueReminders();
    expect(mockPush.sendCareReminder).not.toHaveBeenCalled();
    expect(mockPrisma.reminderConfig.update).toHaveBeenCalled(); // nextDueAt advanced
  });

  it('should skip non-onboarded user', async () => {
    due(baseConfig(baseUser({ isOnboarded: false }), shanghaiHhmmOffset(-10)));
    await service.checkDueReminders();
    expect(mockPush.sendCareReminder).not.toHaveBeenCalled();
  });

  it('should skip user with active pause', async () => {
    const futureEnd = new Date(Date.now() + 86400000);
    due(baseConfig(baseUser({ pauseLogs: [{ isActive: true, endTime: futureEnd }] }), shanghaiHhmmOffset(-10)));
    await service.checkDueReminders();
    expect(mockPush.sendCareReminder).not.toHaveBeenCalled();
  });

  it('should send care reminder when window ended and user not replied', async () => {
    due(baseConfig(baseUser(), shanghaiHhmmOffset(-5)));
    mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
    mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'grace' });

    await service.checkDueReminders();
    expect(mockPush.sendCareReminder).toHaveBeenCalledWith('tok1', '小李');
    expect(mockPrisma.guardStatus.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { status: 'grace' } }),
    );
  });

  it('should trigger alert when grace period expired', async () => {
    // endTime 在 40 分钟前，grace 30 分钟 → grace deadline 已过
    due(
      baseConfig(
        baseUser({
          devices: [],
          contacts: [{ id: 'c1', name: '妈妈', phone: '13800001111' }],
          guardStatus: { id: 'gs1', status: 'grace', lastReplyAt: null },
        }),
        shanghaiHhmmOffset(-40),
      ),
    );
    mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'grace' });
    mockPrisma.guardStatus.upsert.mockResolvedValue({ id: 'gs1', status: 'alert' });
    mockPrisma.alertEvent.findFirst.mockResolvedValue(null);
    mockPrisma.alertEvent.create.mockResolvedValue({});

    await service.checkDueReminders();
    expect(mockPrisma.alertEvent.create).toHaveBeenCalled();
    expect(mockNotificationQueue.enqueueAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        contacts: [{ id: 'c1', phone: '13800001111' }],
        nickname: '小李',
        round: 1,
      }),
    );
  });

  it('should not create duplicate active alert', async () => {
    due(
      baseConfig(
        baseUser({
          devices: [],
          contacts: [{ id: 'c1', name: '妈妈', phone: '13800001111' }],
          guardStatus: { id: 'gs1', status: 'grace', lastReplyAt: null },
        }),
        shanghaiHhmmOffset(-40),
      ),
    );
    mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'grace' });
    mockPrisma.guardStatus.upsert.mockResolvedValue({ id: 'gs1', status: 'alert' });
    mockPrisma.alertEvent.findFirst.mockResolvedValue({ id: 'ae1', status: 'active' });

    await service.checkDueReminders();
    expect(mockPrisma.alertEvent.create).not.toHaveBeenCalled();
    // 已有活跃告警 → round 2，仍重新投递通知
    expect(mockNotificationQueue.enqueueAlert).toHaveBeenCalledWith(
      expect.objectContaining({ round: 2 }),
    );
  });
});
