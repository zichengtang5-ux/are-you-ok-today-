import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';
import * as fs from 'fs';

const APPLE_MAPS_API_BASE_URL = 'https://maps-api.apple.com';
const ADDRESS_CACHE_TTL_MS = 10 * 60 * 1000;
const ADDRESS_CACHE_MAX_ENTRIES = 500;

interface AppleMapsTokenResponse {
  accessToken?: string;
  expiresInSeconds?: number;
}

interface AppleMapsPlace {
  name?: string;
  formattedAddressLines?: string[];
  structuredAddress?: {
    administrativeArea?: string;
    locality?: string;
    subLocality?: string;
    dependentLocalities?: string[];
    thoroughfare?: string;
    fullThoroughfare?: string;
    areasOfInterest?: string[];
  };
}

interface AppleMapsPlacesResponse {
  results?: AppleMapsPlace[];
}

export interface ReverseGeocodeResult {
  address: string;
  provider: 'apple_maps_server';
}

function uniqueParts(parts: Array<string | null | undefined>): string[] {
  const result: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (value && !result.includes(value)) result.push(value);
  }
  return result;
}

export function formatAppleMapsAddress(place: AppleMapsPlace | undefined): string {
  if (!place) return '';
  const formattedLines = uniqueParts(place.formattedAddressLines ?? []);
  if (formattedLines.length > 0) return formattedLines.join('');

  const structured = place.structuredAddress;
  return uniqueParts([
    structured?.administrativeArea,
    structured?.locality,
    structured?.subLocality,
    ...(structured?.dependentLocalities ?? []),
    structured?.fullThoroughfare,
    structured?.thoroughfare,
    ...(structured?.areasOfInterest ?? []),
    place.name,
  ]).join('');
}

@Injectable()
export class AppleMapsService {
  private readonly logger = new Logger(AppleMapsService.name);
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private readonly addressCache = new Map<string, { address: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('APPLE_MAPS_TEAM_ID', '') &&
        this.config.get<string>('APPLE_MAPS_KEY_ID', '') &&
        (this.config.get<string>('APPLE_MAPS_PRIVATE_KEY', '') ||
          this.config.get<string>('APPLE_MAPS_PRIVATE_KEY_PATH', '')),
    );
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null> {
    if (!this.isConfigured()) return null;

    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = this.addressCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { address: cached.address, provider: 'apple_maps_server' };
    }
    if (cached) this.addressCache.delete(cacheKey);

    const timeoutMs = this.config.get<number>('APPLE_MAPS_TIMEOUT_MS', 1800);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let accessToken = await this.getAccessToken(controller.signal);
      let response = await this.requestReverseGeocode(
        latitude,
        longitude,
        accessToken,
        controller.signal,
      );

      if (response.status === 401) {
        this.accessToken = null;
        this.accessTokenExpiresAt = 0;
        accessToken = await this.getAccessToken(controller.signal);
        response = await this.requestReverseGeocode(
          latitude,
          longitude,
          accessToken,
          controller.signal,
        );
      }

      if (!response.ok) {
        this.logger.warn(`[Apple Maps] reverse geocode failed with HTTP ${response.status}`);
        return null;
      }

      const body = (await response.json()) as AppleMapsPlacesResponse;
      const address = formatAppleMapsAddress(body.results?.[0]);
      if (!address) return null;

      this.putAddressCache(cacheKey, address);
      return { address, provider: 'apple_maps_server' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[Apple Maps] reverse geocode unavailable: ${message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getAccessToken(signal: AbortSignal): Promise<string> {
    if (this.accessToken && this.accessTokenExpiresAt > Date.now() + 30_000) {
      return this.accessToken;
    }

    const mapsAuthToken = this.createMapsAuthToken();
    const response = await fetch(`${APPLE_MAPS_API_BASE_URL}/v1/token`, {
      headers: { Authorization: `Bearer ${mapsAuthToken}` },
      signal,
    });
    if (!response.ok) {
      throw new Error(`token request failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as AppleMapsTokenResponse;
    if (!body.accessToken || !body.expiresInSeconds) {
      throw new Error('token response is missing required fields');
    }

    this.accessToken = body.accessToken;
    this.accessTokenExpiresAt = Date.now() + body.expiresInSeconds * 1000;
    return body.accessToken;
  }

  private createMapsAuthToken(): string {
    const teamId = this.requiredConfig('APPLE_MAPS_TEAM_ID');
    const keyId = this.requiredConfig('APPLE_MAPS_KEY_ID');
    const privateKey = this.readPrivateKey();

    return sign(
      { iss: teamId, scope: 'server_api' },
      privateKey,
      {
        algorithm: 'ES256',
        keyid: keyId,
        expiresIn: '5m',
      },
    );
  }

  private requestReverseGeocode(
    latitude: number,
    longitude: number,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<Response> {
    const url = new URL('/v1/reverseGeocode', APPLE_MAPS_API_BASE_URL);
    url.searchParams.set('loc', `${latitude},${longitude}`);
    url.searchParams.set('lang', 'zh-CN');
    return fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
  }

  private readPrivateKey(): string {
    const inlineKey = this.config.get<string>('APPLE_MAPS_PRIVATE_KEY', '');
    if (inlineKey) return inlineKey.replace(/\\n/g, '\n');

    const keyPath = this.requiredConfig('APPLE_MAPS_PRIVATE_KEY_PATH');
    return fs.readFileSync(keyPath, 'utf8');
  }

  private requiredConfig(key: string): string {
    const value = this.config.get<string>(key, '');
    if (!value) throw new Error(`${key} is not configured`);
    return value;
  }

  private putAddressCache(key: string, address: string) {
    if (this.addressCache.size >= ADDRESS_CACHE_MAX_ENTRIES) {
      const oldestKey = this.addressCache.keys().next().value as string | undefined;
      if (oldestKey) this.addressCache.delete(oldestKey);
    }
    this.addressCache.set(key, {
      address,
      expiresAt: Date.now() + ADDRESS_CACHE_TTL_MS,
    });
  }
}
