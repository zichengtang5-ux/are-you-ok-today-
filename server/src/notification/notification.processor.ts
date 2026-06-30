import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { VoiceService } from '../voice/voice.service';
import { NOTIFICATION_QUEUE, NotificationJob } from './notification.types';

/**
 * 通知投递消费者。每个任务对应一条 NotificationLog。
 *
 * 重试策略由 BullMQ 全局配置（attempts=5 + 指数退避）驱动：
 * - 投递失败（服务返回 false 或抛异常）→ 抛错触发 BullMQ 重试
 * - 重试耗尽 → 触发 'failed' 事件，写 failReason（死信，保留记录供排查）
 * - 成功 → 写 status=sent + sentAt + providerMessageId
 */
@Processor(NOTIFICATION_QUEUE, { concurrency: 20 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    private readonly voiceService: VoiceService,
  ) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const { logId, channel, phone, message, nickname, lastReplyAt } = job.data;

    await this.prisma.notificationLog.update({
      where: { id: logId },
      data: { attempts: { increment: 1 } },
    });

    let ok = false;
    if (channel === 'sms') {
      ok = await this.smsService.sendAlertSms(phone, message ?? '');
    } else {
      ok = await this.voiceService.sendAlertVoice(phone, nickname ?? '用户', lastReplyAt ?? '从未回复');
    }

    if (!ok) {
      // 返回 false 视为本次投递失败，抛错让 BullMQ 重试
      throw new Error(`Delivery failed: channel=${channel} phone=${phone}`);
    }

    await this.prisma.notificationLog.update({
      where: { id: logId },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJob>, err: Error): Promise<void> {
    // 仅在重试耗尽（最后一次尝试）时落为最终失败/死信
    const attemptsMade = job.attemptsMade ?? 0;
    const maxAttempts = job.opts?.attempts ?? 1;
    if (attemptsMade < maxAttempts) {
      this.logger.warn(
        `Notification ${job.data.logId} attempt ${attemptsMade}/${maxAttempts} failed, will retry: ${err.message}`,
      );
      return;
    }

    this.logger.error(
      `Notification ${job.data.logId} exhausted ${maxAttempts} attempts (dead-letter): ${err.message}`,
    );
    await this.prisma.notificationLog
      .update({
        where: { id: job.data.logId },
        data: { status: 'failed', failReason: err.message.slice(0, 480) },
      })
      .catch((e) => this.logger.error(`Failed to mark notification log failed: ${e}`));
  }
}
