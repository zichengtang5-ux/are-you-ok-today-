import * as Location from 'expo-location';

export interface CurrentAddressResult {
  address: string;
  hint: string;
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
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    position = await Location.getLastKnownPositionAsync({
      requiredAccuracy: 3000,
      maxAge: 10 * 60 * 1000,
    });
  }

  if (!position) {
    throw new Error('暂时无法获取当前位置');
  }

  const [geo] = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  const address = geo ? formatAddress(geo) : '';
  if (!address) {
    throw new Error('暂时无法解析当前位置');
  }

  return {
    address,
    hint: '请补充具体门牌号（如 3 号楼 502），方便紧急联系人和救援准确找到你',
  };
}
