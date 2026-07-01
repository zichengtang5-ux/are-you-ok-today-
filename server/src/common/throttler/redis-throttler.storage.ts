import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

/**
 * 基于 Redis 的限流存储，保证多实例部署时限流计数一致
 * （默认的内存 storage 在多实例下各算各的，等于限流失效）。
 *
 * 用 Redis INCR + PEXPIRE 实现滑动窗口计数；支持 @nestjs/throttler v6 的
 * blockDuration（超限后封禁一段时间）。
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const countKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle-block:${throttlerName}:${key}`;

    // 处于封禁期：直接返回封禁剩余时间
    const blockTtl = await this.redis.pttl(blockKey);
    if (blockTtl > 0) {
      const total = await this.redis.get(countKey);
      return {
        totalHits: Number(total) || limit + 1,
        timeToExpire: Math.ceil(blockTtl / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockTtl / 1000),
      };
    }

    // 原子自增 + 首次设置窗口过期
    const totalHits = await this.redis.incr(countKey);
    if (totalHits === 1) {
      await this.redis.pexpire(countKey, ttl);
    }
    const windowTtl = await this.redis.pttl(countKey);

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (totalHits > limit) {
      isBlocked = true;
      // 触发封禁
      await this.redis.set(blockKey, '1', 'PX', blockDuration);
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
    }

    return {
      totalHits,
      timeToExpire: windowTtl > 0 ? Math.ceil(windowTtl / 1000) : Math.ceil(ttl / 1000),
      isBlocked,
      timeToBlockExpire,
    };
  }
}
