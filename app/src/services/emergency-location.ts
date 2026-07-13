import * as Location from 'expo-location';

export const EMERGENCY_LOCATION_TIMEOUT_MS = 12_000;
export const EMERGENCY_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
export const EMERGENCY_CACHE_MAX_ACCURACY_METERS = 100;
export const PRECISE_LOCATION_METERS = 20;
export const USABLE_LOCATION_METERS = 100;

export type EmergencyFixSource = 'last_known' | 'live';
export type PrecisionAuthorization = 'full' | 'reduced';
export type LocationQuality = 'precise' | 'usable' | 'rough' | 'unknown';

export interface EmergencyLocationFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: number;
  fixSource: EmergencyFixSource;
  precisionAuthorization: PrecisionAuthorization;
}

export type EmergencyLocationStatus =
  | 'complete'
  | 'permission_denied'
  | 'services_disabled'
  | 'unavailable'
  | 'cancelled';

export interface EmergencyLocationResult {
  status: EmergencyLocationStatus;
  fix: EmergencyLocationFix | null;
}

interface CollectEmergencyLocationOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onFix?: (fix: EmergencyLocationFix) => void;
}

export function classifyLocationAccuracy(accuracyMeters: number | null): LocationQuality {
  if (accuracyMeters === null) return 'unknown';
  if (accuracyMeters <= PRECISE_LOCATION_METERS) return 'precise';
  if (accuracyMeters <= USABLE_LOCATION_METERS) return 'usable';
  return 'rough';
}

function getAccuracy(location: Location.LocationObject): number | null {
  const accuracy = location.coords.accuracy;
  return typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0
    ? accuracy
    : null;
}

function toFix(
  location: Location.LocationObject,
  fixSource: EmergencyFixSource,
  precisionAuthorization: PrecisionAuthorization,
): EmergencyLocationFix {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: getAccuracy(location),
    capturedAt: location.timestamp,
    fixSource,
    precisionAuthorization,
  };
}

function isBetterLiveFix(
  candidate: EmergencyLocationFix,
  current: EmergencyLocationFix | null,
): boolean {
  if (!current) return true;
  if (candidate.accuracyMeters === null) {
    return current.accuracyMeters === null && candidate.capturedAt > current.capturedAt;
  }
  if (current.accuracyMeters === null) return true;
  return (
    candidate.accuracyMeters < current.accuracyMeters ||
    (candidate.accuracyMeters === current.accuracyMeters &&
      candidate.capturedAt > current.capturedAt)
  );
}

export async function collectEmergencyLocation(
  options: CollectEmergencyLocationOptions = {},
): Promise<EmergencyLocationResult> {
  const { signal, onFix, timeoutMs = EMERGENCY_LOCATION_TIMEOUT_MS } = options;
  if (signal?.aborted) return { status: 'cancelled', fix: null };

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return { status: 'permission_denied', fix: null };
  }

  if (!(await Location.hasServicesEnabledAsync())) {
    return { status: 'services_disabled', fix: null };
  }

  const precisionAuthorization: PrecisionAuthorization =
    permission.ios?.accuracy === 'reduced' || permission.android?.accuracy === 'coarse'
      ? 'reduced'
      : 'full';

  let cachedFix: EmergencyLocationFix | null = null;
  let bestLiveFix: EmergencyLocationFix | null = null;
  let subscription: Location.LocationSubscription | null = null;
  let stopped = false;
  let finishLiveCollection: (() => void) | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    subscription?.remove();
    finishLiveCollection?.();
  };

  const abortHandler = () => stop();
  signal?.addEventListener('abort', abortHandler, { once: true });

  const cachedPromise = Location.getLastKnownPositionAsync({
    maxAge: EMERGENCY_CACHE_MAX_AGE_MS,
    requiredAccuracy: EMERGENCY_CACHE_MAX_ACCURACY_METERS,
  })
    .then((location) => {
      if (!location || stopped) return;
      cachedFix = toFix(location, 'last_known', precisionAuthorization);
      if (!bestLiveFix) onFix?.(cachedFix);
    })
    .catch(() => undefined);

  const livePromise = new Promise<void>((resolve) => {
    let resolved = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (timeout) clearTimeout(timeout);
      resolve();
    };
    finishLiveCollection = finish;
    timeout = setTimeout(finish, timeoutMs);

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 0,
      },
      (location) => {
        if (stopped) return;
        const candidate = toFix(location, 'live', precisionAuthorization);
        if (!isBetterLiveFix(candidate, bestLiveFix)) return;

        bestLiveFix = candidate;
        onFix?.(candidate);
        if (
          precisionAuthorization === 'full' &&
          candidate.accuracyMeters !== null &&
          candidate.accuracyMeters <= PRECISE_LOCATION_METERS
        ) {
          finish();
        }
      },
      finish,
    )
      .then((locationSubscription) => {
        subscription = locationSubscription;
        if (stopped || resolved) locationSubscription.remove();
      })
      .catch(finish);
  });

  try {
    await Promise.all([cachedPromise, livePromise]);
  } finally {
    stop();
    signal?.removeEventListener('abort', abortHandler);
  }

  if (signal?.aborted) return { status: 'cancelled', fix: null };
  const fix = bestLiveFix ?? cachedFix;
  return { status: fix ? 'complete' : 'unavailable', fix };
}
