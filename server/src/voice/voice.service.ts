import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';

@Injectable()
export class VoiceService implements OnModuleDestroy {
  private readonly logger = new Logger(VoiceService.name);
  private readonly provider: string;
  private client: $OpenApi.default | null = null;

  constructor(private config: ConfigService) {
    this.provider = this.config.get('VOICE_PROVIDER', 'mock');
    if (this.provider === 'aliyun') {
      this.client = this.createClient();
    }
  }

  onModuleDestroy() {
    this.client = null;
  }

  async sendAlertVoice(phone: string, nickname: string, lastReplyAt: string): Promise<boolean> {
    if (this.provider === 'mock') {
      this.logger.log(`[MOCK VOICE] 语音通知 -> ${phone}: ${nickname}, 最后回复: ${lastReplyAt}`);
      return true;
    }

    const ttsCode = this.config.get('ALIYUN_VOICE_ALERT_TEMPLATE_CODE', '');
    return this.sendAliyunVoice(phone, ttsCode, JSON.stringify({ nickname, lastReplyAt }));
  }

  private async sendAliyunVoice(
    phone: string,
    ttsCode: string,
    ttsParam: string,
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.error('[Aliyun Voice] Client not initialized');
      return false;
    }

    try {
      const params = new $OpenApi.Params({
        action: 'SingleCallByTts',
        version: '2017-05-25',
        protocol: 'HTTPS',
        method: 'POST',
        authType: 'AK',
        style: 'RPC',
        pathname: '/',
        reqBodyType: 'json',
        bodyType: 'json',
      });

      const queries: Record<string, unknown> = {
        CalledNumber: phone,
        TtsCode: ttsCode,
        TtsParam: ttsParam,
      };

      const request = new $OpenApi.OpenApiRequest({ query: queries });
      const runtime = new $Util.RuntimeOptions({
        readTimeout: 5000,
        connectTimeout: 5000,
      });

      const result = await this.client.callApi(params, request, runtime);
      const body = (result as Record<string, any>)?.body;

      if (body?.Code === 'OK') {
        this.logger.log(`[Aliyun Voice] 拨打成功 -> ${phone}`);
        return true;
      }

      this.logger.error(
        `[Aliyun Voice] 拨打失败 -> ${phone}: code=${body?.Code} msg=${body?.Message}`,
      );
      return false;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Aliyun Voice] 拨打异常 -> ${phone}: ${errMsg}`);
      return false;
    }
  }

  private createClient(): $OpenApi.default {
    const accessKeyId = this.config.get('ALIYUN_ACCESS_KEY_ID', '');
    const accessKeySecret = this.config.get('ALIYUN_ACCESS_KEY_SECRET', '');

    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: 'dyvmsapi.aliyuncs.com',
    });

    return new $OpenApi.default(config);
  }
}
