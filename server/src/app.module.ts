import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ObservabilityModule } from './observability/observability.module';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';
import { NotificationModule } from './notification/notification.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ContactModule } from './contact/contact.module';
import { ReminderModule } from './reminder/reminder.module';
import { AlertModule } from './alert/alert.module';
import { GuardianModule } from './guardian/guardian.module';
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
    ThrottlerModule.forRoot([{
      ttl: 60_000,
      limit: 30,
    }]),
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
    GuardianModule,
    SubscriptionModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
