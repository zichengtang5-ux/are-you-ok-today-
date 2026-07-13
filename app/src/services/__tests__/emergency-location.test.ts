import * as Location from 'expo-location';
import {
  classifyLocationAccuracy,
  collectEmergencyLocation,
} from '../emergency-location';

jest.mock('expo-location', () => ({
  Accuracy: { Highest: 5 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const mockLocation = Location as jest.Mocked<typeof Location>;

function position(accuracy: number, timestamp: number, latitude = 39.9) {
  return {
    coords: {
      latitude,
      longitude: 116.4,
      altitude: null,
      accuracy,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp,
  } as Location.LocationObject;
}

describe('emergency location collection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
      ios: { scope: 'whenInUse', accuracy: 'full' },
    } as Location.LocationPermissionResponse);
    mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);
  });

  it('publishes a recent cached fix, then returns the best live fix', async () => {
    const remove = jest.fn();
    mockLocation.getLastKnownPositionAsync.mockResolvedValue(position(60, 1));
    mockLocation.watchPositionAsync.mockImplementation(async (_options, callback) => {
      callback(position(45, 2));
      callback(position(12, 3));
      callback(position(30, 4));
      return { remove };
    });
    const updates: number[] = [];

    const result = await collectEmergencyLocation({
      timeoutMs: 50,
      onFix: (fix) => updates.push(fix.accuracyMeters ?? -1),
    });

    expect(result.status).toBe('complete');
    expect(result.fix).toEqual(
      expect.objectContaining({ accuracyMeters: 12, fixSource: 'live', capturedAt: 3 }),
    );
    expect(updates).toContain(12);
    expect(remove).toHaveBeenCalled();
    expect(mockLocation.getLastKnownPositionAsync).toHaveBeenCalledWith({
      maxAge: 120_000,
      requiredAccuracy: 100,
    });
  });

  it('falls back to the recent cached fix when no live fix arrives', async () => {
    const remove = jest.fn();
    mockLocation.getLastKnownPositionAsync.mockResolvedValue(position(80, 10));
    mockLocation.watchPositionAsync.mockResolvedValue({ remove });

    const result = await collectEmergencyLocation({ timeoutMs: 1 });

    expect(result).toEqual({
      status: 'complete',
      fix: expect.objectContaining({ accuracyMeters: 80, fixSource: 'last_known' }),
    });
    expect(remove).toHaveBeenCalled();
  });

  it('reports reduced precision on a completed fix', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
      ios: { scope: 'whenInUse', accuracy: 'reduced' },
    } as Location.LocationPermissionResponse);
    mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
    mockLocation.watchPositionAsync.mockImplementation(async (_options, callback) => {
      callback(position(80, 10));
      return { remove: jest.fn() };
    });

    const result = await collectEmergencyLocation({ timeoutMs: 1 });

    expect(result).toEqual({
      status: 'complete',
      fix: expect.objectContaining({ precisionAuthorization: 'reduced' }),
    });
  });

  it('cancels without requesting permission when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      collectEmergencyLocation({ signal: controller.signal, timeoutMs: 1 }),
    ).resolves.toEqual({ status: 'cancelled', fix: null });
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('classifies accuracy thresholds for UI messaging', () => {
    expect(classifyLocationAccuracy(20)).toBe('precise');
    expect(classifyLocationAccuracy(100)).toBe('usable');
    expect(classifyLocationAccuracy(101)).toBe('rough');
    expect(classifyLocationAccuracy(null)).toBe('unknown');
  });
});
