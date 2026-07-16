import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockSend = jest.fn();
const mockShutdown = jest.fn();
jest.mock('apn', () => {
  return {
    __esModule: true,
    Provider: jest.fn().mockImplementation(() => ({
      send: mockSend,
      shutdown: mockShutdown,
    })),
    Notification: jest.fn().mockImplementation(() => ({
      expiry: 0,
      sound: '',
      alert: {},
      topic: '',
      payload: {},
      mutableContent: false,
    })),
  };
});

import { PushService } from './push.service';

describe('PushService', () => {
  let service: PushService;

  describe('mock mode', () => {
    beforeEach(async () => {
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          PushService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, def?: string) =>
                key === 'APNS_PROVIDER' ? 'mock' : def,
              ),
            },
          },
        ],
      }).compile();
      service = mod.get(PushService);
    });

    it('should log care reminder in mock mode', async () => {
      const result = await service.sendCareReminder('device-token-1', '妈妈');
      expect(result).toBe(true);
    });

    it('should log alert notification in mock mode', async () => {
      const result = await service.sendAlertNotification('device-token-1', '妈妈', '20:30');
      expect(result).toBe(true);
    });

    it('should log the guard alert notification in mock mode', async () => {
      const result = await service.sendGuardAlertNotification('device-token-1');
      expect(result).toBe(true);
    });
  });

  describe('apns mode', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          PushService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, def?: string) => {
                const map: Record<string, string> = {
                  APNS_PROVIDER: 'apns',
                  APNS_KEY_ID: 'KEY123',
                  APNS_TEAM_ID: 'TEAM456',
                  APNS_KEY_PATH: '/path/to/key.p8',
                  APNS_BUNDLE_ID: 'com.todayok.app',
                  NODE_ENV: 'production',
                };
                return map[key] ?? def;
              }),
            },
          },
        ],
      }).compile();
      service = mod.get(PushService);
    });

    it('should send care reminder via APNs', async () => {
      mockSend.mockResolvedValue({ sent: ['token1'], failed: [] });

      const result = await service.sendCareReminder('token1', '妈妈');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalled();
      const note = mockSend.mock.calls[0][0];
      expect(note.alert).toEqual({
        title: '还没收到你的回复',
        body: '妈妈，超时后将自动联系紧急联系人，点击立即报平安。',
      });
      expect(note.payload).toEqual({
        type: 'grace_reminder',
        guardState: 'grace',
        action: 'open_app',
        route: 'home',
      });
      expect(note.aps.category).toBe('safety_grace');
    });

    it('should send the guard alert notification via APNs', async () => {
      mockSend.mockResolvedValue({ sent: ['token1'], failed: [] });

      const result = await service.sendGuardAlertNotification('token1');

      expect(result).toBe(true);
      const note = mockSend.mock.calls[0][0];
      expect(note.alert).toEqual({
        title: '已自动联系紧急联系人',
        body: '联系人正在确认你的安全，点击告诉他们你没事。',
      });
      expect(note.payload).toEqual({
        type: 'guard_alert',
        guardState: 'alert',
        action: 'open_app',
        route: 'home',
      });
      expect(note.aps.category).toBe('safety_alert');
    });

    it('should send alert notification via APNs', async () => {
      mockSend.mockResolvedValue({ sent: ['token1'], failed: [] });

      const result = await service.sendAlertNotification('token1', '妈妈', '20:30');

      expect(result).toBe(true);
    });

    it('should return false when APNs reports failure', async () => {
      mockSend.mockResolvedValue({
        sent: [],
        failed: [{ device: 'token1', response: { reason: 'BadDeviceToken' } }],
      });

      const result = await service.sendCareReminder('token1', '妈妈');
      expect(result).toBe(false);
    });

    it('should return false on APNs exception', async () => {
      mockSend.mockRejectedValue(new Error('Connection refused'));

      const result = await service.sendCareReminder('token1', '妈妈');
      expect(result).toBe(false);
    });
  });
});
