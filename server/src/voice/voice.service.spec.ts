import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockCallApi = jest.fn();
jest.mock('@alicloud/openapi-client', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      callApi: mockCallApi,
    })),
    Config: jest.fn().mockImplementation(() => ({})),
    OpenApiRequest: jest.fn().mockImplementation((opts) => opts),
    Params: jest.fn().mockImplementation((opts) => opts),
  };
});
jest.mock('@alicloud/tea-util', () => {
  return {
    __esModule: true,
    RuntimeOptions: jest.fn().mockImplementation((opts) => opts),
  };
});

import { VoiceService } from './voice.service';

describe('VoiceService', () => {
  let service: VoiceService;

  describe('mock mode', () => {
    beforeEach(async () => {
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          VoiceService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn((key: string, def?: string) => (key === 'VOICE_PROVIDER' ? 'mock' : def)) },
          },
        ],
      }).compile();
      service = mod.get(VoiceService);
    });

    it('should log voice call in mock mode', async () => {
      const result = await service.sendAlertVoice('13800001111', '小李', '2026-06-28T10:00:00Z');
      expect(result).toBe(true);
    });

    it('should return true for any phone number in mock mode', async () => {
      const result = await service.sendAlertVoice('13900002222', '妈妈', '从未回复');
      expect(result).toBe(true);
    });
  });

  describe('aliyun mode', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          VoiceService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, def?: string) => {
                const map: Record<string, string> = {
                  VOICE_PROVIDER: 'aliyun',
                  ALIYUN_ACCESS_KEY_ID: 'test-key-id',
                  ALIYUN_ACCESS_KEY_SECRET: 'test-key-secret',
                  ALIYUN_VOICE_ALERT_TEMPLATE_CODE: 'TTS_001',
                };
                return map[key] ?? def;
              }),
            },
          },
        ],
      }).compile();
      service = mod.get(VoiceService);
    });

    it('should send voice call via Aliyun API', async () => {
      mockCallApi.mockResolvedValue({ body: { Code: 'OK', CallId: 'call-123' } });

      const result = await service.sendAlertVoice('13800001111', '小李', '2026-06-28T10:00:00Z');

      expect(result).toBe(true);
      expect(mockCallApi).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SingleCallByTts' }),
        expect.objectContaining({
          query: expect.objectContaining({
            CalledNumber: '13800001111',
            TtsCode: 'TTS_001',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should return false on API error response', async () => {
      mockCallApi.mockResolvedValue({
        body: { Code: 'isv.BUSINESS_LIMIT_CONTROL', Message: '触发限流' },
      });

      const result = await service.sendAlertVoice('13800001111', '小李', '2026-06-28T10:00:00Z');
      expect(result).toBe(false);
    });

    it('should return false on network exception', async () => {
      mockCallApi.mockRejectedValue(new Error('Network timeout'));

      const result = await service.sendAlertVoice('13800001111', '小李', '2026-06-28T10:00:00Z');
      expect(result).toBe(false);
    });
  });
});
