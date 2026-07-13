import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AppleMapsService, formatAppleMapsAddress } from './apple-maps.service';

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('AppleMapsService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('formats structured addresses when formatted lines are unavailable', () => {
    expect(
      formatAppleMapsAddress({
        name: '腾讯滨海大厦',
        structuredAddress: {
          administrativeArea: '广东省',
          locality: '深圳市',
          subLocality: '南山区',
          thoroughfare: '海天二路',
          areasOfInterest: ['腾讯滨海大厦'],
        },
      }),
    ).toBe('广东省深圳市南山区海天二路腾讯滨海大厦');
  });

  it('exchanges an auth JWT for an access token and caches reverse geocoding', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const values: Record<string, string | number> = {
      APPLE_MAPS_TEAM_ID: 'TEAM123456',
      APPLE_MAPS_KEY_ID: 'KEY1234567',
      APPLE_MAPS_PRIVATE_KEY: pem,
      APPLE_MAPS_TIMEOUT_MS: 1000,
    };
    const config = {
      get: jest.fn((key: string, defaultValue: unknown) => values[key] ?? defaultValue),
    } as unknown as ConfigService;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        response(200, { accessToken: 'maps-access-token', expiresInSeconds: 1800 }),
      )
      .mockResolvedValueOnce(
        response(200, {
          results: [{ formattedAddressLines: ['广东省深圳市南山区', '腾讯滨海大厦'] }],
        }),
      );
    global.fetch = fetchMock as typeof fetch;
    const service = new AppleMapsService(config);

    await expect(service.reverseGeocode(22.533, 113.934)).resolves.toEqual({
      address: '广东省深圳市南山区腾讯滨海大厦',
      provider: 'apple_maps_server',
    });
    await expect(service.reverseGeocode(22.53301, 113.93401)).resolves.toEqual({
      address: '广东省深圳市南山区腾讯滨海大厦',
      provider: 'apple_maps_server',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://maps-api.apple.com/v1/token');
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      '/v1/reverseGeocode?loc=22.533%2C113.934&lang=zh-CN',
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        headers: { Authorization: 'Bearer maps-access-token' },
      }),
    );
  });

  it('returns null without making a request when credentials are not configured', async () => {
    const config = {
      get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
    } as unknown as ConfigService;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(new AppleMapsService(config).reverseGeocode(39.9, 116.4)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
