import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule, REDIS_CLIENT } from './redis/redis.module';
import Redis from 'ioredis';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { ObservabilityModule } from './observability/observability.module';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { EventsModule } from './events/events.module';
import { NotificationModule } from './notification/notification.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ContactModule } from './contact/contact.module';
import { ReminderModule } from './reminder/reminder.module';
import { AlertModule } from './alert/alert.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SmsModule } from './sms/sms.module';
import { PushModule } from './push/push.module';
import { VoiceModule } from './voice/voice.module';
import { DeviceModule } from './device/device.module';
import { HelpModule } from './help/help.module';
import { PauseModule } from './pause/pause.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        // 默认档：常规接口 100 次/分钟。敏感接口（验证码/登录）在 controller 上
        // 用 @Throttle 覆盖为更严格的档位（见 auth.controller）。
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        // 用 Redis 存储限流计数，保证多实例一致
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 24 * 3600, count: 10_000 },
          removeOnFail: false, // 失败任务保留，便于死信排查
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    ObservabilityModule,
    EventsModule,
    NotificationModule,
    SmsModule,
    PushModule,
    VoiceModule,
    AuthModule,
    UserModule,
    ContactModule,
    ReminderModule,
    AlertModule,
    DeviceModule,
    HelpModule,
    PauseModule,
    SubscriptionModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
