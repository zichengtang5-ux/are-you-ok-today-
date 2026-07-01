import { EventsService } from './events.service';
import { firstValueFrom, toArray, take } from 'rxjs';

/**
 * EventsService 测试 —— 验证跨实例事件的发布 payload 与按 userId 的订阅过滤。
 * 不触发 onModuleInit（那会建真实 Redis 订阅连接），直接测 publish + subscribe。
 */
describe('EventsService', () => {
  let service: EventsService;
  const mockRedis = { publish: jest.fn().mockResolvedValue(1) };
  const mockConfig = { get: (_k: string, d: unknown) => d };

  beforeEach(() => {
    service = new EventsService(mockRedis as never, mockConfig as never);
    jest.clearAllMocks();
  });

  describe('publish', () => {
    it('publishes a JSON event with an at timestamp to the channel', async () => {
      await service.publish({ userId: 'u1', type: 'alert_triggered', payload: { round: 1 } });
      expect(mockRedis.publish).toHaveBeenCalledWith('user-events', expect.any(String));
      const [, json] = mockRedis.publish.mock.calls[0];
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(
        expect.objectContaining({ userId: 'u1', type: 'alert_triggered', payload: { round: 1 } }),
      );
      expect(typeof parsed.at).toBe('string');
    });
  });

  describe('subscribe', () => {
    it('only delivers events matching the subscribed userId', async () => {
      // 手动向内部事件流注入（模拟 Redis message 到达）
      const stream = (service as unknown as { stream$: { next: (e: unknown) => void } }).stream$;

      const collected = firstValueFrom(service.subscribe('u1').pipe(take(2), toArray()));

      stream.next({ userId: 'u2', type: 'status_changed', at: 't1' }); // 应被过滤
      stream.next({ userId: 'u1', type: 'status_changed', at: 't2' });
      stream.next({ userId: 'u3', type: 'alert_triggered', at: 't3' }); // 应被过滤
      stream.next({ userId: 'u1', type: 'alert_resolved', at: 't4' });

      const events = await collected;
      expect(events.map((e) => e.data.type)).toEqual(['status_changed', 'alert_resolved']);
      expect(events.every((e) => e.data.userId === 'u1')).toBe(true);
    });
  });
});
