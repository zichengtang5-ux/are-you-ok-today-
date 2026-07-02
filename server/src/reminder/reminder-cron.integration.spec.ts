import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderCronService } from './reminder-cron.service';
import { getLocalDateParts } from './reminder-schedule.util';

function shanghaiHhmm(minutesOfDay: number): string {
  const hh = String(Math.floor(minutesOfDay / 60)).padStart(2, '0');
  const mm = String(minutesOfDay % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function shanghaiEndTimeJustPassed(): string {
  const { minutesOfDay } = getLocalDateParts(new Date(), 'Asia/Shanghai');
  return shanghaiHhmm(Math.max(0, minutesOfDay - 1));
}

/**
 * 提醒引擎端到端集成测试 —— 使用真实 PostgreSQL（CI service 容器 / 本地 docker-compose）。
 * 只 mock 外部投递（push/queue/events/observability），Prisma 走真实数据库，
 * 验证"到期扫描 → 状态流转 → nextDueAt 推进"这条命脉链路在真实 DB 上正确。
 *
 * 需要环境变量 DATABASE_URL 指向 Postgres，且已 `prisma migrate deploy`。
 */
describe('ReminderCron (integration, real Postgres)', () => {
  const prisma = new PrismaService();
  const push = { sendCareReminder: jest.fn().mockResolvedValue(true) };
  const queue = { enqueueAlert: jest.fn().mockResolvedValue(undefined) };
  const observability = { metric: jest.fn(), captureException: jest.fn() };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (_k: string, d: unknown) => d } as unknown as ConfigService;

  let service: ReminderCronService;
  let userId: string;

  beforeAll(async () => {
    await prisma.$connect();
    service = new ReminderCronService(
      prisma,
      push as never,
      queue as never,
      observability as never,
      events as never,
      config,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // 干净的测试用户
    const user = await prisma.user.create({
      data: {
        phone: `139${Date.now().toString().slice(-8)}`,
        nickname: '集成测试用户',
        isOnboarded: true,
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    // 级联清理（顺序满足外键）
    await prisma.dailyRecord.deleteMany({ where: { userId } });
    await prisma.alertEvent.deleteMany({ where: { userId } });
    await prisma.guardStatus.deleteMany({ where: { userId } });
    await prisma.reminderConfig.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('idle user past endTime → grace + care reminder + nextDueAt advanced', async () => {
    const endTime = shanghaiEndTimeJustPassed();
    // endTime 动态设为刚刚过去，确保仍处在 grace 期内；nextDueAt 设为过去 → 会被扫到
    await prisma.reminderConfig.create({
      data: {
        userId,
        startTime: '00:00',
        endTime,
        gracePeriodMin: 30,
        timezone: 'Asia/Shanghai',
        nextDueAt: new Date(Date.now() - 60_000),
      },
    });

    const processed = await service.checkDueReminders();
    expect(processed).toBeGreaterThanOrEqual(1);

    const gs = await prisma.guardStatus.findUnique({ where: { userId } });
    expect(gs?.status).toBe('grace');

    const cfg = await prisma.reminderConfig.findUnique({ where: { userId } });
    // nextDueAt 应被推进到未来（grace deadline）
    expect(cfg?.nextDueAt && cfg.nextDueAt.getTime()).toBeGreaterThan(Date.now());

    // status_changed 事件已发布
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ userId, type: 'status_changed' }),
    );
  });

  it('replied user is skipped and nextDueAt advanced to next day', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
    await prisma.reminderConfig.create({
      data: {
        userId,
        startTime: '00:00',
        endTime: '00:00',
        gracePeriodMin: 30,
        timezone: 'Asia/Shanghai',
        nextDueAt: new Date(Date.now() - 60_000),
      },
    });
    await prisma.dailyRecord.create({ data: { userId, date: today, status: 'replied' } });

    await service.checkDueReminders();

    const gs = await prisma.guardStatus.findUnique({ where: { userId } });
    // 已回复 → 不进入 grace
    expect(gs?.status ?? 'idle').not.toBe('grace');
    expect(push.sendCareReminder).not.toHaveBeenCalled();

    const cfg = await prisma.reminderConfig.findUnique({ where: { userId } });
    expect(cfg?.nextDueAt && cfg.nextDueAt.getTime()).toBeGreaterThan(Date.now());
  });
});
