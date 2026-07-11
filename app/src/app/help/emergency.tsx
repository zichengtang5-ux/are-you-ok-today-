import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Banner, Button, Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { helpApi, type EmergencyHelpResponse } from '@/services/api.types';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Radius, Shadows, Spacing } from '@/theme';

type SendStage = 'idle' | 'sending' | 'sent' | 'error';
type AddressSource = 'gps' | 'user_preset' | 'manual' | null;
type Coordinates = { lat: number; lon: number };

const DEFAULT_PRESET_ADDRESS = '北京市海淀区悠然颂人才社区 8202';
const LOCATION_TIMEOUT_MS = 8_000;
const LOW_ACCURACY_METERS = 100;

function maskPhone(phone: string): string {
  if (phone.length >= 7) return phone.slice(0, 3) + '****' + phone.slice(-4);
  return phone;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function formatRoughAddress(place: Location.LocationGeocodedAddress): string {
  const parts = [
    place.region,
    place.city,
    place.district,
    place.subregion,
    place.street,
    place.streetNumber,
    place.name,
  ].filter((part): part is string => Boolean(part?.trim()));

  return Array.from(new Set(parts)).join('');
}

export default function EmergencyHelpScreen() {
  const router = useRouter();
  const savedAddress = useStore((state) => state.user?.address);
  const [isLocating, setIsLocating] = useState(true);
  const [sendStage, setSendStage] = useState<SendStage>('idle');
  const [roughAddress, setRoughAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [addressSource, setAddressSource] = useState<AddressSource>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [horizontalAccuracy, setHorizontalAccuracy] = useState<number | null>(null);
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [locationWarning, setLocationWarning] = useState('');
  const [sendError, setSendError] = useState('');
  const [result, setResult] = useState<EmergencyHelpResponse | null>(null);

  const resolvePresetAddress = useCallback(
    () => savedAddress?.trim() || DEFAULT_PRESET_ADDRESS,
    [savedAddress],
  );

  const applyPresetFallback = useCallback(
    (message: string) => {
      setRoughAddress(resolvePresetAddress());
      setAddressSource('user_preset');
      setCoords(null);
      setHorizontalAccuracy(null);
      setLowAccuracy(true);
      setLocationWarning(message);
    },
    [resolvePresetAddress],
  );

  const fetchLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationWarning('');
    setSendError('');

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        applyPresetFallback('未获得定位权限，已使用预设地址。请核对并补充具体位置。');
        return;
      }

      let location: Location.LocationObject;
      try {
        location = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
          LOCATION_TIMEOUT_MS,
        );
      } catch {
        applyPresetFallback('暂时无法定位，已使用预设地址。请核对并补充具体位置。');
        return;
      }

      const accuracy =
        typeof location.coords.accuracy === 'number' && location.coords.accuracy >= 0
          ? location.coords.accuracy
          : null;
      const isReducedPermission =
        permission.ios?.accuracy === 'reduced' || permission.android?.accuracy === 'coarse';
      const isLowAccuracy =
        isReducedPermission || accuracy === null || accuracy > LOW_ACCURACY_METERS;

      setCoords({ lat: location.coords.latitude, lon: location.coords.longitude });
      setHorizontalAccuracy(accuracy);
      setLowAccuracy(isLowAccuracy);

      const places = await withTimeout(
        Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
        LOCATION_TIMEOUT_MS,
      ).catch(() => []);
      const formattedAddress = places[0] ? formatRoughAddress(places[0]) : '';

      if (formattedAddress) {
        setRoughAddress(formattedAddress);
        setAddressSource('gps');
        if (isReducedPermission) {
          setLocationWarning('系统仅提供大概位置，请务必补充楼栋、门牌或房间号。');
        } else if (isLowAccuracy) {
          setLocationWarning('当前定位精度较低，请补充楼栋、门牌或房间号。');
        }
      } else {
        setRoughAddress(resolvePresetAddress());
        setAddressSource('user_preset');
        setLocationWarning('已取得经纬度，但地址解析失败。当前显示预设地址，请核对。');
      }
    } catch {
      applyPresetFallback('定位服务暂不可用，已使用预设地址。请核对并补充具体位置。');
    } finally {
      setIsLocating(false);
    }
  }, [applyPresetFallback, resolvePresetAddress]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLocation();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLocation]);

  const combinedAddress = [
    roughAddress.trim(),
    detailAddress.trim() ? `具体位置：${detailAddress.trim()}` : '',
  ]
    .filter(Boolean)
    .join('；');
  const canSend = !isLocating && sendStage !== 'sending' && Boolean(combinedAddress);

  const accuracyText =
    horizontalAccuracy === null
      ? ''
      : `约 ±${Math.max(1, Math.ceil(horizontalAccuracy)).toLocaleString('zh-CN')} 米`;
  const locationMeta = (() => {
    if (isLocating) return '正在获取大概位置...';
    if (addressSource === 'user_preset' && !coords) {
      return '仅大概位置 · 当前使用预设地址';
    }
    if (lowAccuracy) {
      return `仅大概位置${accuracyText ? ` · ${accuracyText}` : ''}`;
    }
    return accuracyText ? `定位精度 ${accuracyText}` : '已获取当前位置';
  })();

  const handleRoughAddressChange = (value: string) => {
    setRoughAddress(value);
    setAddressSource('manual');
    setSendError('');
  };

  const sendEmergency = async () => {
    if (!combinedAddress) {
      setSendError('请填写可发送给紧急联系人的位置。');
      return;
    }

    setSendStage('sending');
    setSendError('');
    try {
      const response = await helpApi.emergency({
        latitude: coords?.lat,
        longitude: coords?.lon,
        addressText: combinedAddress,
      });
      setResult(response);
      setSendStage('sent');
    } catch (error: any) {
      setSendError(
        error?.response?.data?.message ??
          '求助发送失败，请检查网络后重试；情况紧急时请主动拨打 110 或 120。',
      );
      setSendStage('error');
    }
  };

  const dialPublicService = async (number: '110' | '120') => {
    try {
      await Linking.openURL(`tel:${number}`);
    } catch {
      Alert.alert('无法打开拨号', `请在手机拨号界面手动拨打 ${number}。`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar
        variant="white"
        title="紧急求助"
        showMascot={false}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={styles.title}>需要帮助时</Text>
          <Text style={styles.subtitle}>先核对位置，再把 SOS 发给你的紧急联系人</Text>
        </View>

        <Card style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconWrap}>
              <Text style={styles.locationIcon}>⌖</Text>
            </View>
            <View style={styles.locationHeading}>
              <Text style={styles.locationTitle}>求助位置</Text>
              <Text style={[styles.locationMeta, lowAccuracy && styles.locationMetaWarn]}>
                {locationMeta}
              </Text>
            </View>
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : sendStage !== 'sent' ? (
              <Pressable onPress={fetchLocation} hitSlop={10}>
                <Text style={styles.refreshText}>重新定位</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>大概位置</Text>
            <TextInput
              value={roughAddress}
              onChangeText={handleRoughAddressChange}
              editable={sendStage !== 'sent'}
              multiline
              placeholder={isLocating ? '正在定位...' : '请输入所在区域或道路'}
              placeholderTextColor={Colors.gray400}
              accessibilityLabel="大概位置"
              style={[styles.input, sendStage === 'sent' && styles.inputDisabled]}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.detailLabelRow}>
              <Text style={styles.fieldLabel}>补充具体位置</Text>
              <Text style={styles.optionalText}>建议填写</Text>
            </View>
            <TextInput
              value={detailAddress}
              onChangeText={(value) => {
                setDetailAddress(value);
                setSendError('');
              }}
              editable={sendStage !== 'sent'}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholder="如：3 号楼 2 单元 8202，门禁说明或明显标志"
              placeholderTextColor={Colors.gray400}
              accessibilityLabel="补充楼栋门牌房间等具体位置"
              style={[
                styles.input,
                styles.detailInput,
                sendStage === 'sent' && styles.inputDisabled,
              ]}
            />
          </View>

          {locationWarning ? <Banner variant="warn">{locationWarning}</Banner> : null}
        </Card>

        {sendStage === 'sent' && result ? (
          <Card style={styles.successCard}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>求助已发出</Text>
              <Text style={styles.successText}>位置和求助信息已发送给紧急联系人</Text>
            </View>
          </Card>
        ) : (
          <View>
            <Pressable
              onPress={sendEmergency}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="发送 SOS 给紧急联系人"
              accessibilityHint="立即发送当前位置和补充地址，不会自动拨打公共急救电话"
              style={({ pressed }) => [
                styles.sosButton,
                pressed && canSend && styles.sosButtonPressed,
                !canSend && styles.sosButtonDisabled,
              ]}
            >
              {sendStage === 'sending' ? (
                <ActivityIndicator color={Colors.white} size="large" />
              ) : (
                <>
                  <Text style={styles.sosText}>发送 SOS</Text>
                  <Text style={styles.sosSubtext}>立即通知所有紧急联系人</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.sosNotice}>不会自动拨打 110 或 120</Text>
          </View>
        )}

        {sendError ? <Banner variant="danger">{sendError}</Banner> : null}

        <Card style={styles.publicCallCard}>
          <Text style={styles.sectionTitle}>需要公共急救时</Text>
          <Text style={styles.sectionSubtitle}>请根据情况主动选择，点击后由 iOS 系统确认拨号</Text>
          <View style={styles.publicCallRow}>
            <Pressable
              onPress={() => dialPublicService('110')}
              accessibilityRole="button"
              accessibilityLabel="拨打 110 报警"
              style={({ pressed }) => [styles.publicCallButton, pressed && styles.callPressed]}
            >
              <Text style={styles.publicCallNumber}>110</Text>
              <Text style={styles.publicCallLabel}>报警</Text>
            </Pressable>
            <Pressable
              onPress={() => dialPublicService('120')}
              accessibilityRole="button"
              accessibilityLabel="拨打 120 急救"
              style={({ pressed }) => [styles.publicCallButton, pressed && styles.callPressed]}
            >
              <Text style={styles.publicCallNumber}>120</Text>
              <Text style={styles.publicCallLabel}>医疗急救</Text>
            </Pressable>
          </View>
        </Card>

        {sendStage === 'sent' && result && result.contactsNotified.length > 0 ? (
          <Card title="已通知的联系人" style={styles.contactsCard}>
            {result.contactsNotified.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.contactInfo}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{contact.name[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactPhone}>{maskPhone(contact.phone)}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => Linking.openURL(`tel:${contact.phone}`)}
                  style={styles.contactCallButton}
                >
                  <Text style={styles.contactCallText}>拨打</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Text style={styles.disclaimer}>
          SOS 只会通知你设置的紧急联系人，不会自动拨打 110、120 或其他公共急救电话。
        </Text>

        {sendStage === 'sent' ? (
          <Button variant="outline" onPress={() => router.back()} style={styles.backButton}>
            返回首页
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  intro: {
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: Colors.gray600,
  },
  locationCard: {
    gap: Spacing.md,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIcon: {
    fontSize: 24,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  locationHeading: {
    flex: 1,
  },
  locationTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  locationMeta: {
    marginTop: 2,
    fontSize: FontSizes.xs,
    color: Colors.primaryDark,
  },
  locationMetaWarn: {
    color: Colors.warmDark,
  },
  refreshText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  field: {
    gap: Spacing.sm,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.gray700,
  },
  optionalText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    color: Colors.primary,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.gray300,
    borderRadius: Radius.md,
    backgroundColor: Colors.gray50,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: FontSizes.base,
    lineHeight: 22,
    color: Colors.gray900,
  },
  detailInput: {
    minHeight: 88,
  },
  inputDisabled: {
    color: Colors.gray600,
    backgroundColor: Colors.gray100,
  },
  sosButton: {
    minHeight: 80,
    borderRadius: Radius.lg,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadows.md,
  },
  sosButtonPressed: {
    backgroundColor: Colors.dangerDark,
  },
  sosButtonDisabled: {
    opacity: 0.5,
  },
  sosText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.white,
  },
  sosSubtext: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.white,
  },
  sosNotice: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.gray500,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    backgroundColor: Colors.primaryLight,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  successIconText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.white,
  },
  successCopy: {
    flex: 1,
  },
  successTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.primaryDark,
  },
  successText: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: Colors.gray700,
  },
  publicCallCard: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  sectionSubtitle: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: Colors.gray600,
  },
  publicCallRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  publicCallButton: {
    flex: 1,
    minHeight: 68,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callPressed: {
    backgroundColor: Colors.dangerLight,
  },
  publicCallNumber: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.danger,
  },
  publicCallLabel: {
    marginTop: 2,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    color: Colors.gray700,
  },
  contactsCard: {
    gap: Spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  contactInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  contactAvatarText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  contactName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  contactPhone: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
  },
  contactCallButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  contactCallText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.white,
  },
  disclaimer: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
    textAlign: 'center',
    color: Colors.gray500,
  },
  backButton: {
    marginTop: Spacing.xs,
  },
});
