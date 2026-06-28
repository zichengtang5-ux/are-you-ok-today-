import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as apn from 'apn';

@Injectable()
export class PushService implements OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private readonly provider: string;
  private apnProvider: apn.Provider | null = null;
  private readonly bundleId: string;

  constructor(private config: ConfigService) {
    this.provider = this.config.get('APNS_PROVIDER', 'mock');
    this.bundleId = this.config.get('APNS_BUNDLE_ID', 'com.todayok.app');

    if (this.provider === 'apns') {
      this.apnProvider = this.createProvider();
    }
  }

  onModuleDestroy() {
    if (this.apnProvider) {
      this.apnProvider.shutdown();
      this.apnProvider = null;
    }
  }

  async sendCareReminder(token: string, userNickname?: string | null): Promise<boolean> {
    const title = '没收到你的回应';
    const body = '有点担心，看到消息回一下？';

    if (this.provider === 'mock') {
      this.logger.log(`[MOCK APNs] 关心提醒 -> ${token}: ${title} - ${body}`);
      return true;
    }

    return this.sendApns(token, title, body, { type: 'care_reminder' });
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

    return this.sendApns(token, title, body, { type: 'alert_notification' });
  }

  private async sendApns(
    token: string,
    title: string,
    body: string,
    payload: Record<string, string>,
  ): Promise<boolean> {
    if (!this.apnProvider) {
      this.logger.error('[APNs] Provider not initialized');
      return false;
    }

    try {
      const note = new apn.Notification();
      note.expiry = Math.floor(Date.now() / 1000) + 3600;
      note.sound = 'default';
      note.alert = { title, body };
      note.topic = this.bundleId;
      note.payload = payload;
      note.mutableContent = true;

      const result = await this.apnProvider.send(note, token);

      if (result.failed.length > 0) {
        const failure = result.failed[0];
        this.logger.error(
          `[APNs] 推送失败 -> ${token}: ${failure.response?.reason ?? 'unknown'}`,
        );
        return false;
      }

      this.logger.log(`[APNs] 推送成功 -> ${token}: ${title}`);
      return true;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[APNs] 推送异常 -> ${token}: ${errMsg}`);
      return false;
    }
  }

  private createProvider(): apn.Provider | null {
    const keyId = this.config.get('APNS_KEY_ID', '');
    const teamId = this.config.get('APNS_TEAM_ID', '');
    const keyPath = this.config.get('APNS_KEY_PATH', '');

    if (!keyId || !teamId || !keyPath) {
      this.logger.error('[APNs] Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_KEY_PATH');
      return null;
    }

    return new apn.Provider({
      token: { key: keyPath, keyId, teamId },
      production: this.config.get('NODE_ENV') === 'production',
    });
  }
}
