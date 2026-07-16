import AsyncStorage from '@react-native-async-storage/async-storage';
import ExpoWatchConnectivity, {
  type WatchConnectivityAvailability,
} from '../../modules/expo-watch-connectivity';
import { API_BASE_URL } from './config';

export interface WatchContextOptions {
  isOnboarded: boolean;
}

export interface WatchContextPayload {
  schemaVersion: 1;
  apiBaseURL: string;
  accessToken: string;
  refreshToken: string;
  isOnboarded: boolean;
  syncedAt: string;
}

const unavailable: WatchConnectivityAvailability = {
  supported: false,
  paired: false,
  installed: false,
};

export async function syncWatchContext(
  options: WatchContextOptions,
): Promise<WatchConnectivityAvailability> {
  if (!ExpoWatchConnectivity) return unavailable;

  const [accessToken, refreshToken] = await AsyncStorage.multiGet([
    'access_token',
    'refresh_token',
  ]);
  const access = accessToken[1];
  const refresh = refreshToken[1];
  if (!access || !refresh) {
    await clearWatchContext();
    return ExpoWatchConnectivity.getAvailability();
  }

  const payload: WatchContextPayload = {
    schemaVersion: 1,
    apiBaseURL: API_BASE_URL.replace(/\/$/, ''),
    accessToken: access,
    refreshToken: refresh,
    isOnboarded: options.isOnboarded,
    syncedAt: new Date().toISOString(),
  };

  return ExpoWatchConnectivity.sync(JSON.stringify(payload));
}

export async function clearWatchContext(): Promise<void> {
  await ExpoWatchConnectivity?.clear();
}
