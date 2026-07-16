import * as Location from 'expo-location';

export interface CurrentAddressResult {
  address: string;
  hint: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: number;
}

function uniqueParts(parts: (string | null | undefined)[]): string[] {
  const result: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (value && !result.includes(value)) {
      result.push(value);
    }
  }
  return result;
}

function formatAddress(geo: Location.LocationGeocodedAddress): string {
  const g = geo as Location.LocationGeocodedAddress & {
    district?: string | null;
    streetNumber?: string | null;
  };
  return uniqueParts([
    g.region,
    g.city,
    g.district,
    g.street,
    g.streetNumber,
    g.name,
  ]).join('');
}

export async function getCurrentAddress(): Promise<CurrentAddressResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('需要定位权限来自动填充地址');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('系统定位服务未开启');
  }

  let position: Location.LocationObject | null = null;
  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    position = await Location.getLastKnownPositionAsync({
      requiredAccuracy: 100,
      maxAge: 2 * 60 * 1000,
    });
  }

  if (!position) {
    throw new Error('暂时无法获取当前位置');
  }

  let geo: Location.LocationGeocodedAddress | undefined;
  try {
    [geo] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  } catch {
    // A simulator (or a temporarily unavailable geocoder) may still provide a
    // valid GPS fix. Keep the coordinates instead of rejecting the location.
  }

  const resolvedAddress = geo ? formatAddress(geo) : '';
  const coordinateAddress = `当前位置（${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}）`;
  const address = resolvedAddress || coordinateAddress;

  return {
    address,
    hint: resolvedAddress
      ? '请补充具体门牌号（如 3 号楼 502），方便紧急联系人和救援准确找到你'
      : '已获取定位坐标，但暂时无法解析地址，请手动改成具体住址和门牌号',
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters:
      typeof position.coords.accuracy === 'number' && position.coords.accuracy >= 0
        ? position.coords.accuracy
        : null,
    capturedAt: position.timestamp,
  };
}
