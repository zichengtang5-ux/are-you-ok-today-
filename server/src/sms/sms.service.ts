import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;

  constructor(private config: ConfigService) {
    this.provider = this.config.get('SMS_PROVIDER', 'mock');
  }

  async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    if (this.provider === 'mock') {
      this.logger.log(`[MOCK SMS] 验证码 ${code} -> ${phone}`);
      return true;
    }

    return this.sendAliyunSms(phone, code);
  }

  private async sendAliyunSms(phone: string, code: string): Promise<boolean> {
    // TODO: 实现阿里云 SMS API 调用（S2 阶段）
    this.logger.warn(`[Aliyun SMS] Not implemented yet. code=${code} phone=${phone}`);
    return false;
  }

  async sendAlertSms(phone: string, message: string): Promise<boolean> {
    if (this.provider === 'mock') {
      this.logger.log(`[MOCK SMS] 告警通知 -> ${phone}: ${message}`);
      return true;
    }

    this.logger.warn(`[Aliyun SMS] Alert SMS not implemented yet.`);
    return false;
  }
}
