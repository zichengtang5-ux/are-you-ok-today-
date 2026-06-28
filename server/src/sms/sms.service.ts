import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dysmsapi20170525, * as $Dysmsapi from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';

@Injectable()
export class SmsService implements OnModuleDestroy {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;
  private client: Dysmsapi20170525 | null = null;

  constructor(private config: ConfigService) {
    this.provider = this.config.get('SMS_PROVIDER', 'mock');
    if (this.provider === 'aliyun') {
      this.client = this.createClient();
    }
  }

  onModuleDestroy() {
    this.client = null;
  }

  async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    if (this.provider === 'mock') {
      this.logger.log(`[MOCK SMS] 验证码 ${code} -> ${phone}`);
      return true;
    }

    const templateCode = this.config.get('ALIYUN_SMS_VERIFY_TEMPLATE_CODE', '');
    return this.sendAliyunSms(phone, templateCode, JSON.stringify({ code }));
  }

  async sendAlertSms(phone: string, message: string): Promise<boolean> {
    if (this.provider === 'mock') {
      this.logger.log(`[MOCK SMS] 告警通知 -> ${phone}: ${message}`);
      return true;
    }

    const templateCode = this.config.get('ALIYUN_SMS_ALERT_TEMPLATE_CODE', '');
    return this.sendAliyunSms(phone, templateCode, JSON.stringify({ message }));
  }

  private async sendAliyunSms(
    phone: string,
    templateCode: string,
    templateParam: string,
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.error('[Aliyun SMS] Client not initialized');
      return false;
    }

    const signName = this.config.get('ALIYUN_SMS_SIGN_NAME', '');

    try {
      const sendSmsRequest = new $Dysmsapi.SendSmsRequest({
        phoneNumbers: phone,
        signName,
        templateCode,
        templateParam,
      });

      const runtime = new $Util.RuntimeOptions({
        readTimeout: 5000,
        connectTimeout: 5000,
      });

      const result = await this.client.sendSmsWithOptions(sendSmsRequest, runtime);

      if (result.body?.code === 'OK') {
        this.logger.log(`[Aliyun SMS] 发送成功 -> ${phone}`);
        return true;
      }

      this.logger.error(
        `[Aliyun SMS] 发送失败 -> ${phone}: code=${result.body?.code} msg=${result.body?.message}`,
      );
      return false;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Aliyun SMS] 发送异常 -> ${phone}: ${errMsg}`);
      return false;
    }
  }

  private createClient(): Dysmsapi20170525 {
    const accessKeyId = this.config.get('ALIYUN_ACCESS_KEY_ID', '');
    const accessKeySecret = this.config.get('ALIYUN_ACCESS_KEY_SECRET', '');

    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com',
    });

    return new Dysmsapi20170525(config);
  }
}
