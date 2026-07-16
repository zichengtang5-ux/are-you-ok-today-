import * as Location from 'expo-location';
import { getCurrentAddress } from '../location';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const mockLocation = Location as jest.Mocked<typeof Location>;
const position = {
  coords: {
    latitude: 31.230416,
    longitude: 121.473701,
    altitude: null,
    accuracy: 12,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: 1_700_000_000_000,
};

describe('getCurrentAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);
    mockLocation.getCurrentPositionAsync.mockResolvedValue(position);
  });

  it('uses the reverse-geocoded address when available', async () => {
    mockLocation.reverseGeocodeAsync.mockResolvedValue([
      { region: '上海市', city: '上海市', district: '黄浦区', street: '人民大道', streetNumber: '200号' } as any,
    ]);

    await expect(getCurrentAddress()).resolves.toEqual(
      expect.objectContaining({ address: '上海市黄浦区人民大道200号' }),
    );
  });

  it('keeps valid coordinates when reverse geocoding is unavailable', async () => {
    mockLocation.reverseGeocodeAsync.mockRejectedValue(new Error('geocoder unavailable'));

    await expect(getCurrentAddress()).resolves.toEqual(
      expect.objectContaining({
        address: '当前位置（31.230416, 121.473701）',
        hint: expect.stringContaining('请手动改成具体住址'),
      }),
    );
  });
});
