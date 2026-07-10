import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEV_MOCK_CODE = '123456';
export const DEV_MOCK_ACCESS_TOKEN = 'dev-access-token';

/** Allows the complete onboarding flow to be demonstrated when the local API is unavailable. */
export async function isOfflineDevSession(): Promise<boolean> {
  if (!__DEV__) return false;
  return (await AsyncStorage.getItem('access_token')) === DEV_MOCK_ACCESS_TOKEN;
}
