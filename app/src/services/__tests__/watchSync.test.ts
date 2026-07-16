import AsyncStorage from '@react-native-async-storage/async-storage';
import ExpoWatchConnectivity from '../../../modules/expo-watch-connectivity';
import { clearWatchContext, syncWatchContext } from '../watchSync';

jest.mock('../../../modules/expo-watch-connectivity', () => ({
  __esModule: true,
  default: {
    sync: jest.fn(),
    clear: jest.fn(),
    getAvailability: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    multiGet: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  API_BASE_URL: 'https://api.todayok.example/api/',
}));

const mockNativeModule = (jest.requireMock('../../../modules/expo-watch-connectivity') as {
  default: {
    sync: jest.Mock;
    clear: jest.Mock;
    getAvailability: jest.Mock;
  };
}).default;
const multiGet = AsyncStorage.multiGet as jest.Mock;

describe('watchSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.sync.mockResolvedValue({ supported: true, paired: true, installed: true });
    mockNativeModule.clear.mockResolvedValue(undefined);
    mockNativeModule.getAvailability.mockReturnValue({ supported: true, paired: true, installed: true });
  });

  it('uses the native Watch connectivity module', () => {
    expect(ExpoWatchConnectivity).toBe(mockNativeModule);
  });

  it('syncs tokens and onboarding state without a trailing API slash', async () => {
    multiGet.mockResolvedValue([
      ['access_token', 'access-1'],
      ['refresh_token', 'refresh-1'],
    ]);

    await syncWatchContext({ isOnboarded: true });

    const payload = JSON.parse(mockNativeModule.sync.mock.calls[0][0]);
    expect(payload).toEqual(expect.objectContaining({
      schemaVersion: 1,
      apiBaseURL: 'https://api.todayok.example/api',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      isOnboarded: true,
    }));
    expect(payload.syncedAt).toEqual(expect.any(String));
  });

  it('clears stale watch credentials when phone tokens are absent', async () => {
    multiGet.mockResolvedValue([
      ['access_token', null],
      ['refresh_token', null],
    ]);

    await syncWatchContext({ isOnboarded: false });

    expect(mockNativeModule.clear).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.sync).not.toHaveBeenCalled();
  });

  it('exposes an explicit clear operation for logout and account deletion', async () => {
    await clearWatchContext();
    expect(mockNativeModule.clear).toHaveBeenCalledTimes(1);
  });
});
