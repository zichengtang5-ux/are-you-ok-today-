import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_QUEUE, NotificationJob } from './notification.types';

interface AlertContact {
  id: string;
  phone: string;
}

interface EnqueueAlertParams {
  contacts: AlertContact[];
  nickname: string;
  lastReplyAt: string;
  round: number;
}

/**
 * 通知投递生产者：将告警通知拆为"每联系人每渠道"的独立任务投入 BullMQ，
 * 取代原 cron 内同步 for-loop 调用阿里云 API。
 *
 * 关键收益：
 * - cron 不再被外部 API 延迟/超时阻塞，单分钟吞吐不受通知服务影响
 * - 每条通知独立重试（BullMQ 指数退避），失败不连带其他联系人
 * - 重试耗尽进入 failed 状态（死信），保留记录供排查
 * - 预创建 NotificationLog(pending)，worker 回写 sent/failed + 回执
 */
@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationJob>,
    private readonly prisma: PrismaService,
  ) {}

  async enqueueAlert(params: EnqueueAlertParams): Promise<void> {
    const { contacts, nickname, lastReplyAt, round } = params;
    const message = `【今天还好】${nickname}今天没有回复平安，最后回复时间：${lastReplyAt}，请及时联系确认。`;

    for (const contact of contacts) {
      await this.enqueueOne({
        contactId: contact.id,
        channel: 'sms',
        round,
        phone: contact.phone,
        message,
      });
      await this.enqueueOne({
        contactId: contact.id,
        channel: 'voice_call',
        round,
        phone: contact.phone,
        nickname,
        lastReplyAt,
      });
    }

    this.logger.log(
      `Enqueued alert notifications: ${contacts.length} contacts × 2 channels (round ${round})`,
    );
  }

  private async enqueueOne(args: {
    contactId: string;
    channel: 'sms' | 'voice_call';
    round: number;
    phone: string;
    message?: string;
    nickname?: string;
    lastReplyAt?: string;
  }): Promise<void> {
    // 先落库一条 pending 记录，worker 据 logId 回写最终状态
    const log = await this.prisma.notificationLog.create({
      data: {
        contactId: args.contactId,
        channel: args.channel,
        round: args.round,
        status: 'pending',
      },
    });

    await this.queue.add(args.channel, {
      logId: log.id,
      channel: args.channel,
      phone: args.phone,
      message: args.message,
      nickname: args.nickname,
      lastReplyAt: args.lastReplyAt,
    });
  }
}
