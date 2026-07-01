import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * RedisThrottlerStorage 测试 —— 验证基于 Redis 的限流计数与封禁逻辑，
 * 保证多实例下限流一致（默认内存 storage 在多实例下会失效）。
 */
describe('RedisThrottlerStorage', () => {
  let redis: {
    pttl: jest.Mock;
    get: jest.Mock;
    incr: jest.Mock;
    pexpire: jest.Mock;
    set: jest.Mock;
  };
  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    redis = {
      pttl: jest.fn(),
      get: jest.fn(),
      incr: jest.fn(),
      pexpire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
    };
    storage = new RedisThrottlerStorage(redis as never);
  });

  it('increments and sets window TTL on first hit', async () => {
    redis.pttl.mockResolvedValueOnce(-2); // block key: no block
    redis.incr.mockResolvedValue(1);
    redis.pttl.mockResolvedValueOnce(60_000); // window ttl after set

    const r = await storage.increment('ip1', 60_000, 5, 300_000, 'default');
    expect(redis.incr).toHaveBeenCalledWith('throttle:default:ip1');
    expect(redis.pexpire).toHaveBeenCalledWith('throttle:default:ip1', 60_000);
    expect(r.totalHits).toBe(1);
    expect(r.isBlocked).toBe(false);
  });

  it('does not reset window TTL on subsequent hits', async () => {
    redis.pttl.mockResolvedValueOnce(-2); // no block
    redis.incr.mockResolvedValue(3);
    redis.pttl.mockResolvedValueOnce(40_000);

    const r = await storage.increment('ip1', 60_000, 5, 300_000, 'default');
    expect(redis.pexpire).not.toHaveBeenCalled(); // 只有 totalHits===1 才设过期
    expect(r.totalHits).toBe(3);
    expect(r.isBlocked).toBe(false);
  });

  it('blocks when limit exceeded and sets block key', async () => {
    redis.pttl.mockResolvedValueOnce(-2); // no block yet
    redis.incr.mockResolvedValue(6); // over limit 5
    redis.pttl.mockResolvedValueOnce(50_000);

    const r = await storage.increment('ip1', 60_000, 5, 300_000, 'strict');
    expect(r.isBlocked).toBe(true);
    expect(r.timeToBlockExpire).toBe(300);
    expect(redis.set).toHaveBeenCalledWith('throttle-block:strict:ip1', '1', 'PX', 300_000);
  });

  it('returns blocked immediately while within block window', async () => {
    redis.pttl.mockResolvedValueOnce(120_000); // block key active
    redis.get.mockResolvedValue('6');

    const r = await storage.increment('ip1', 60_000, 5, 300_000, 'strict');
    expect(r.isBlocked).toBe(true);
    expect(r.timeToBlockExpire).toBe(120);
    // 封禁期不再自增
    expect(redis.incr).not.toHaveBeenCalled();
  });
});
