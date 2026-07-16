import { requireOptionalNativeModule } from 'expo-modules-core';

export interface WatchConnectivityAvailability {
  supported: boolean;
  paired: boolean;
  installed: boolean;
}

interface ExpoWatchConnectivityNativeModule {
  sync(payloadJSON: string): Promise<WatchConnectivityAvailability>;
  clear(): Promise<void>;
  getAvailability(): WatchConnectivityAvailability;
}

export default requireOptionalNativeModule<ExpoWatchConnectivityNativeModule>(
  'ExpoWatchConnectivity',
);
