import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationProcessor } from './notification.processor';
import { NOTIFICATION_QUEUE } from './notification.types';

/**
 * 通知投递模块：注册 BullMQ 队列（生产者 + 消费者）。
 * SmsService/VoiceService/PrismaService 均为全局模块，自动可注入。
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  providers: [NotificationQueueService, NotificationProcessor],
  exports: [NotificationQueueService],
})
export class NotificationModule {}
