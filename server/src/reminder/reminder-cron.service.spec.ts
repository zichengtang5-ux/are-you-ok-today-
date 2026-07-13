import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReminderCronService } from './reminder-cron.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { ObservabilityService } from '../observability/observability.module';
import { EventsService } from '../events/events.service';
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
  const mockPrisma: any = {
    reminderConfig: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    dailyRecord: { findUnique: jest.fn(), upsert: jest.fn().mockResolvedValue({}) },
    guardStatus: { upsert: jest.fn() },
    alertEvent: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    notificationLog: { create: jest.fn().mockResolvedValue({}) },
    pauseLog: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(async (arg: unknown): Promise<unknown> => {
      if (typeof arg === 'function') return (arg as (tx: any) => unknown)(mockPrisma);
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
  const mockPush = { sendCareReminder: jest.fn().mockResolvedValue(true) };
  const mockNotificationQueue = { enqueueAlert: jest.fn().mockResolvedValue(undefined) };
  const mockObservability = { metric: jest.fn(), captureException: jest.fn() };
  const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };
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
        { provide: ObservabilityService, useValue: mockObservability },
        { provide: EventsService, useValue: mockEvents },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = mod.get(ReminderCronService);
    jest.clearAllMocks();
    mockPrisma.reminderConfig.update.mockResolvedValue({});
    mockPrisma.dailyRecord.upsert.mockResolvedValue({});
    mockPrisma.notificationLog.create.mockResolvedValue({});
    mockPrisma.alertEvent.update.mockResolvedValue({});
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
      subscription: null,
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

  describe('handleReminderCheck (cron entry)', () => {
    it('records metrics on success', async () => {
      mockPrisma.reminderConfig.findMany.mockResolvedValue([]);
      await service.handleReminderCheck();
      expect(mockObservability.metric).toHaveBeenCalledWith(
        'reminder_cron.processed',
        expect.any(Number),
        expect.objectContaining({ shard: '0' }),
      );
      expect(mockObservability.metric).toHaveBeenCalledWith(
        'reminder_cron.duration_ms',
        expect.any(Number),
      );
    });

    it('captures exception when scan throws', async () => {
      mockPrisma.reminderConfig.findMany.mockRejectedValueOnce(new Error('db down'));
      await service.handleReminderCheck();
      expect(mockObservability.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ job: 'reminder_cron' }),
      );
    });

    it('skips re-entry while a previous tick is still running', async () => {
      // 让第一次 findMany 挂起，模拟上一轮未完成
      let release: (v: unknown) => void = () => {};
      mockPrisma.reminderConfig.findMany.mockReturnValueOnce(
        new Promise((res) => {
          release = res;
        }),
      );
      const first = service.handleReminderCheck();
      // 第二次应因 running 标志直接返回，不再触发查询
      await service.handleReminderCheck();
      const callsAfterSecond = mockPrisma.reminderConfig.findMany.mock.calls.length;
      release([]); // 释放第一次，结束循环
      await first;
      expect(callsAfterSecond).toBe(1);
    });
  });

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

  it('should auto-resume an expired pause and continue reminder processing', async () => {
    const pastEnd = new Date(Date.now() - 60_000);
    due(baseConfig(baseUser({
      pauseLogs: [{ isActive: true, endTime: pastEnd }],
      guardStatus: { id: 'gs1', status: 'paused', lastReplyAt: null },
    }), shanghaiHhmmOffset(-5)));
    mockPrisma.dailyRecord.findUnique.mockResolvedValue(null);
    mockPrisma.guardStatus.upsert.mockResolvedValue({ status: 'grace' });

    await service.checkDueReminders();

    expect(mockPrisma.pauseLog.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', isActive: true },
      data: { isActive: false },
    });
    expect(mockPush.sendCareReminder).toHaveBeenCalledWith('tok1', '小李');
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
    mockPrisma.alertEvent.create.mockResolvedValue({ id: 'ae1', smsRounds: 0 });

    await service.checkDueReminders();
    expect(mockPrisma.alertEvent.create).toHaveBeenCalled();
    expect(mockPrisma.alertEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ae1' }, data: { smsRounds: 1 } }),
    );
    expect(mockNotificationQueue.enqueueAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        contacts: [{ id: 'c1', phone: '13800001111' }],
        alertId: 'ae1',
        nickname: '小李',
        round: 1,
        includeVoice: false,
      }),
    );
  });

  it('should include voice calls only for an unexpired premium subscription', async () => {
    due(
      baseConfig(
        baseUser({
          devices: [],
          contacts: [{ id: 'c1', name: '妈妈', phone: '13800001111' }],
          guardStatus: { id: 'gs1', status: 'grace', lastReplyAt: null },
          subscription: {
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
        }),
        shanghaiHhmmOffset(-40),
      ),
    );
    mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'grace' });
    mockPrisma.guardStatus.upsert.mockResolvedValue({ id: 'gs1', status: 'alert' });
    mockPrisma.alertEvent.findFirst.mockResolvedValue(null);
    mockPrisma.alertEvent.create.mockResolvedValue({ id: 'ae1', smsRounds: 0 });

    await service.checkDueReminders();

    expect(mockNotificationQueue.enqueueAlert).toHaveBeenCalledWith(
      expect.objectContaining({ includeVoice: true }),
    );
  });

  it('only alerts the primary contact for a free user with retained premium contacts', async () => {
    due(
      baseConfig(
        baseUser({
          devices: [],
          contacts: [
            { id: 'c1', name: '妈妈', phone: '13800001111' },
            { id: 'c2', name: '爸爸', phone: '13800002222' },
          ],
          guardStatus: { id: 'gs1', status: 'grace', lastReplyAt: null },
          subscription: {
            status: 'expired',
            currentPeriodEnd: new Date(Date.now() - 60_000),
          },
        }),
        shanghaiHhmmOffset(-40),
      ),
    );
    mockPrisma.dailyRecord.findUnique.mockResolvedValue({ status: 'grace' });
    mockPrisma.guardStatus.upsert.mockResolvedValue({ id: 'gs1', status: 'alert' });
    mockPrisma.alertEvent.findFirst.mockResolvedValue(null);
    mockPrisma.alertEvent.create.mockResolvedValue({ id: 'ae1', smsRounds: 0 });

    await service.checkDueReminders();

    expect(mockNotificationQueue.enqueueAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        contacts: [{ id: 'c1', phone: '13800001111' }],
        includeVoice: false,
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
    mockPrisma.alertEvent.findFirst.mockResolvedValue({ id: 'ae1', status: 'active', smsRounds: 1 });

    await service.checkDueReminders();
    expect(mockPrisma.alertEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.alertEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ae1' }, data: { smsRounds: 2 } }),
    );
    // 已有活跃告警 → round 2，仍重新投递通知
    expect(mockNotificationQueue.enqueueAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertId: 'ae1', round: 2 }),
    );
  });
});
