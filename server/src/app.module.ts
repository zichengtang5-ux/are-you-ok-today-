import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
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
    PrismaModule,
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
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
