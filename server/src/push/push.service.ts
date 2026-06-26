import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly provider: string;

  constructor(private config: ConfigService) {
    this.provider = this.config.get('APNS_PROVIDER', 'mock');
  }

  async sendCareReminder(token: string, userNickname?: string | null): Promise<boolean> {
    const title = '没收到你的回应';
    const body = '有点担心，看到消息回一下？';

    if (this.provider === 'mock') {
      this.logger.log(`[MOCK APNs] 关心提醒 -> ${token}: ${title} - ${body}`);
      return true;
    }

    return this.sendApns(token, title, body);
  }

  async sendAlertNotification(
    token: string,
    userNickname: string,
    lastReplyAt: string,
  ): Promise<boolean> {
    const title = `${userNickname} 今天没有回复平安`;
    const body = `最后回复时间：${lastReplyAt}，请及时联系确认`;

    if (this.provider === 'mock') {
      this.logger.log(`[MOCK APNs] 告警通知 -> ${token}: ${title} - ${body}`);
      return true;
    }

    return this.sendApns(token, title, body);
  }

  private async sendApns(token: string, title: string, body: string): Promise<boolean> {
    // TODO: 实现真实 APNs 推送（需要证书配置）
    this.logger.warn(`[APNs] Not implemented yet. token=${token} title=${title} body=${body}`);
    return false;
  }
}
