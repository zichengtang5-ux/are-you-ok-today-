/** BullMQ 通知队列的名称与任务类型定义 */

export const NOTIFICATION_QUEUE = 'notifications';

export type NotificationChannel = 'sms' | 'voice_call';

/**
 * 单条通知投递任务。每个联系人 × 每个渠道 = 一个独立任务，
 * 便于独立重试与死信处理，互不阻塞。
 */
export interface NotificationJob {
  /** 预创建的 NotificationLog 记录 ID，worker 据此回写状态/回执 */
  logId: string;
  channel: NotificationChannel;
  phone: string;
  /** SMS 文案（channel=sms 时使用） */
  message?: string;
  /** 语音参数（channel=voice_call 时使用） */
  nickname?: string;
  lastReplyAt?: string;
}
