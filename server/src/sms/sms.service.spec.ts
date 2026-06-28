import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockSendSmsWithOptions = jest.fn();
jest.mock('@alicloud/dysmsapi20170525', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      sendSmsWithOptions: mockSendSmsWithOptions,
    })),
    SendSmsRequest: jest.fn().mockImplementation((opts) => opts),
  };
});
jest.mock('@alicloud/openapi-client', () => {
  return {
    __esModule: true,
    Config: jest.fn().mockImplementation(() => ({})),
  };
});
jest.mock('@alicloud/tea-util', () => {
  return {
    __esModule: true,
    RuntimeOptions: jest.fn().mockImplementation((opts) => opts),
  };
});

import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;

  describe('mock mode', () => {
    beforeEach(async () => {
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn((key: string, def?: string) => (key === 'SMS_PROVIDER' ? 'mock' : def)) },
          },
        ],
      }).compile();
      service = mod.get(SmsService);
    });

    it('should log verification code in mock mode', async () => {
      const result = await service.sendVerificationCode('13800001111', '123456');
      expect(result).toBe(true);
    });

    it('should log alert SMS in mock mode', async () => {
      const result = await service.sendAlertSms('13800001111', '测试告警');
      expect(result).toBe(true);
    });
  });

  describe('aliyun mode', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, def?: string) => {
                const map: Record<string, string> = {
                  SMS_PROVIDER: 'aliyun',
                  ALIYUN_ACCESS_KEY_ID: 'test-key-id',
                  ALIYUN_ACCESS_KEY_SECRET: 'test-key-secret',
                  ALIYUN_SMS_SIGN_NAME: '今天还好',
                  ALIYUN_SMS_VERIFY_TEMPLATE_CODE: 'SMS_001',
                  ALIYUN_SMS_ALERT_TEMPLATE_CODE: 'SMS_002',
                };
                return map[key] ?? def;
              }),
            },
          },
        ],
      }).compile();
      service = mod.get(SmsService);
    });

    it('should send verification code via Aliyun SMS', async () => {
      mockSendSmsWithOptions.mockResolvedValue({ body: { code: 'OK' } });

      const result = await service.sendVerificationCode('13800001111', '654321');

      expect(result).toBe(true);
      expect(mockSendSmsWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumbers: '13800001111',
          signName: '今天还好',
          templateCode: 'SMS_001',
          templateParam: JSON.stringify({ code: '654321' }),
        }),
        expect.any(Object),
      );
    });

    it('should send alert SMS via Aliyun SMS', async () => {
      mockSendSmsWithOptions.mockResolvedValue({ body: { code: 'OK' } });

      const result = await service.sendAlertSms('13800002222', '家人未回应');

      expect(result).toBe(true);
      expect(mockSendSmsWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumbers: '13800002222',
          templateCode: 'SMS_002',
        }),
        expect.any(Object),
      );
    });

    it('should return false on API error response', async () => {
      mockSendSmsWithOptions.mockResolvedValue({
        body: { code: 'isv.BUSINESS_LIMIT_CONTROL', message: '触发限流' },
      });

      const result = await service.sendVerificationCode('13800001111', '111111');
      expect(result).toBe(false);
    });

    it('should return false on network exception', async () => {
      mockSendSmsWithOptions.mockRejectedValue(new Error('Network timeout'));

      const result = await service.sendVerificationCode('13800001111', '222222');
      expect(result).toBe(false);
    });
  });
});
