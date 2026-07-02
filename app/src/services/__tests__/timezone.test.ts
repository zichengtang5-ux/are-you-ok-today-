/**
 * timezone.ts 测试 —— 出差/跨时区同步逻辑。
 */
import {
  getDeviceTimezone,
  timezoneChanged,
  syncTimezoneIfChanged,
} from '../timezone';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api.types', () => ({
  reminderApi: { updateConfig: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../errorReporter', () => ({ reportError: jest.fn() }));

const mockReminderApi = (jest.requireMock('../api.types') as {
  reminderApi: { updateConfig: jest.Mock };
}).reminderApi;

describe('timezone', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getDeviceTimezone', () => {
    it('returns a non-empty IANA timezone string', () => {
      const tz = getDeviceTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });

  describe('timezoneChanged', () => {
    it('is true when backend has no timezone recorded', () => {
      expect(timezoneChanged(undefined)).toBe(true);
    });
    it('is true when backend tz differs from device', () => {
      expect(timezoneChanged('Pacific/Kiritimati')).toBe(true);
    });
    it('is false when backend tz equals device tz', () => {
      expect(timezoneChanged(getDeviceTimezone())).toBe(false);
    });
  });

  describe('syncTimezoneIfChanged', () => {
    it('does not call updateConfig when backend already matches device', async () => {
      const changed = await syncTimezoneIfChanged(getDeviceTimezone());
      expect(changed).toBe(false);
      expect(mockReminderApi.updateConfig).not.toHaveBeenCalled();
    });

    it('updates backend timezone when device differs', async () => {
      const changed = await syncTimezoneIfChanged('Pacific/Kiritimati');
      expect(changed).toBe(true);
      expect(mockReminderApi.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: getDeviceTimezone() }),
      );
    });

    it('returns false and does not throw when update fails', async () => {
      mockReminderApi.updateConfig.mockRejectedValueOnce(new Error('network'));
      await expect(syncTimezoneIfChanged('Pacific/Kiritimati')).resolves.toBe(false);
    });
  });
});
