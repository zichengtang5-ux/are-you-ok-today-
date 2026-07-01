import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject, filter, map } from 'rxjs';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/** 推送给客户端的实时事件 */
export interface UserEvent {
  userId: string;
  type: 'status_changed' | 'alert_triggered' | 'alert_resolved' | 'reply_confirmed';
  payload?: Record<string, unknown>;
  at: string;
}

const CHANNEL = 'user-events';

/**
 * 实时事件服务：用 Redis pub/sub 跨实例广播用户事件，替代前端 30 秒轮询。
 *
 * - publish(): 任一实例（cron / reply / guardian 代确认）产生状态变化时发布
 * - subscribe(): SSE 端点按 userId 订阅，只推送该用户自己的事件
 *
 * 用 Redis pub/sub 保证多实例：无论客户端连在哪个实例、事件在哪个实例产生，
 * 都能正确投递。订阅使用独立的 ioredis 连接（订阅模式会独占连接）。
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private subscriber!: Redis;
  private readonly stream$ = new Subject<UserEvent>();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // 独立订阅连接
    this.subscriber = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    });
    this.subscriber.subscribe(CHANNEL);
    this.subscriber.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message) as UserEvent;
        this.stream$.next(event);
      } catch {
        // 忽略无法解析的消息
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.stream$.complete();
    if (this.subscriber) {
      await this.subscriber.quit();
    }
  }

  /** 发布一个用户事件（跨实例广播） */
  async publish(event: Omit<UserEvent, 'at'>): Promise<void> {
    const full: UserEvent = { ...event, at: new Date().toISOString() };
    await this.redis.publish(CHANNEL, JSON.stringify(full));
  }

  /** 订阅某用户的事件流（供 SSE 端点使用） */
  subscribe(userId: string): Observable<{ data: UserEvent }> {
    return this.stream$.asObservable().pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ data: e })),
    );
  }
}
