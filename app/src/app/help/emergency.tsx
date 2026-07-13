import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import {
  classifyLocationAccuracy,
  collectEmergencyLocation,
  type EmergencyLocationFix,
} from '@/services/emergency-location';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Radius, Shadows, Spacing } from '@/theme';

type SendStage = 'idle' | 'sending' | 'sent' | 'partial' | 'error';
type AddressSource = 'apple_client' | 'user_preset' | 'manual' | null;

const GEOCODE_TIMEOUT_MS = 3_000;

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
  const [roughAddress, setRoughAddress] = useState(savedAddress?.trim() ?? '');
  const [addressSource, setAddressSource] = useState<AddressSource>(
    savedAddress?.trim() ? 'user_preset' : null,
  );
  const [locationFix, setLocationFix] = useState<EmergencyLocationFix | null>(null);
  const [locationWarning, setLocationWarning] = useState('');
  const [sendError, setSendError] = useState('');
  const [result, setResult] = useState<EmergencyHelpResponse | null>(null);
  const addressSourceRef = useRef<AddressSource>(
    savedAddress?.trim() ? 'user_preset' : null,
  );
  const locationFixRef = useRef<EmergencyLocationFix | null>(null);
  const locationAbortRef = useRef<AbortController | null>(null);
  const pulse = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const resolvePresetAddress = useCallback(async () => {
    if (savedAddress?.trim()) return savedAddress.trim();
    const preset = await helpApi.getAddress().catch(() => null);
    return preset?.address?.trim() || '';
  }, [savedAddress]);

  const updateAddressSource = useCallback((source: AddressSource) => {
    addressSourceRef.current = source;
    setAddressSource(source);
  }, []);

  const applyPresetFallback = useCallback(
    async (message: string) => {
      const presetAddress = await resolvePresetAddress();
      if (addressSourceRef.current !== 'manual' && presetAddress) {
        setRoughAddress(presetAddress);
        updateAddressSource('user_preset');
      }
      setLocationWarning(
        presetAddress
          ? `${message}，已填入保存的住址，请核对。`
          : `${message}，请手动填写所在位置。`,
      );
    },
    [resolvePresetAddress, updateAddressSource],
  );

  const fetchLocation = useCallback(async () => {
    locationAbortRef.current?.abort();
    const controller = new AbortController();
    locationAbortRef.current = controller;
    setIsLocating(true);
    setLocationWarning('');
    setSendError('');

    try {
      if (!roughAddress.trim() && addressSourceRef.current !== 'manual') {
        void resolvePresetAddress().then((presetAddress) => {
          if (!controller.signal.aborted && presetAddress && addressSourceRef.current !== 'manual') {
            setRoughAddress(presetAddress);
            updateAddressSource('user_preset');
          }
        });
      }

      const locationResult = await collectEmergencyLocation({
        signal: controller.signal,
        onFix: (fix) => {
          if (controller.signal.aborted) return;
          locationFixRef.current = fix;
          setLocationFix(fix);
          if (fix.precisionAuthorization === 'reduced') {
            setLocationWarning('未开启精确位置，请在系统设置中开启或手动补充楼栋门牌。');
          } else if (classifyLocationAccuracy(fix.accuracyMeters) === 'rough') {
            setLocationWarning('当前位置较粗略，正在继续提高精度，发送前请核对地址。');
          }
        },
      });

      if (controller.signal.aborted || locationResult.status === 'cancelled') return;
      if (!locationResult.fix) {
        const fallbackMessages: Record<string, string> = {
          permission_denied: '未获得定位权限',
          services_disabled: '系统定位服务未开启',
          unavailable: '暂时无法定位',
        };
        await applyPresetFallback(
          fallbackMessages[locationResult.status] ?? '定位服务暂不可用',
        );
        return;
      }

      const finalFix = locationResult.fix;
      locationFixRef.current = finalFix;
      setLocationFix(finalFix);
      setIsLocating(false);

      const places = await withTimeout(
        Location.reverseGeocodeAsync({
          latitude: finalFix.latitude,
          longitude: finalFix.longitude,
        }),
        GEOCODE_TIMEOUT_MS,
      ).catch(() => []);
      if (controller.signal.aborted) return;
      const formattedAddress = places[0] ? formatRoughAddress(places[0]) : '';

      if (formattedAddress && addressSourceRef.current !== 'manual') {
        setRoughAddress(formattedAddress);
        updateAddressSource('apple_client');
      }

      if (finalFix.precisionAuthorization === 'reduced') {
        setLocationWarning('未开启精确位置，请在系统设置中开启或手动补充楼栋门牌。');
      } else {
        const quality = classifyLocationAccuracy(finalFix.accuracyMeters);
        if (quality === 'rough' || quality === 'unknown') {
          setLocationWarning('当前位置较粗略，请手动确认道路、楼栋和门牌号。');
        } else if (finalFix.fixSource === 'last_known') {
          setLocationWarning('未获取到实时位置，当前为两分钟内的暂定位置，请核对。');
        } else if (!formattedAddress && addressSourceRef.current !== 'manual') {
          const presetAddress = await resolvePresetAddress();
          if (presetAddress) {
            setRoughAddress(presetAddress);
            updateAddressSource('user_preset');
            setLocationWarning('地址解析失败，已显示保存的住址；当前坐标仍会随求助发送。');
          } else {
            setLocationWarning('地址解析失败，当前坐标仍会随求助发送，请补充所在位置。');
          }
        } else {
          setLocationWarning('');
        }
      }
    } catch {
      if (controller.signal.aborted) return;
      await applyPresetFallback('定位服务暂不可用');
    } finally {
      if (locationAbortRef.current === controller) {
        locationAbortRef.current = null;
        setIsLocating(false);
      }
    }
  }, [applyPresetFallback, resolvePresetAddress, roughAddress, updateAddressSource]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLocation();
    }, 0);
    return () => {
      clearTimeout(timer);
      locationAbortRef.current?.abort();
    };
    // fetchLocation intentionally runs once on screen entry. Manual retries call it directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combinedAddress = roughAddress.trim();
  const canSend =
    sendStage !== 'sending' && Boolean(locationFix || combinedAddress);

  const horizontalAccuracy = locationFix?.accuracyMeters ?? null;
  const locationQuality = classifyLocationAccuracy(horizontalAccuracy);
  const lowAccuracy =
    locationFix?.precisionAuthorization === 'reduced' ||
    locationQuality === 'rough' ||
    locationQuality === 'unknown';

  const accuracyText =
    horizontalAccuracy === null
      ? ''
      : `约 ±${Math.max(1, Math.ceil(horizontalAccuracy)).toLocaleString('zh-CN')} 米`;
  const locationMeta = (() => {
    if (addressSource === 'manual') return '已手动编辑';
    if (isLocating && locationFix) {
      return accuracyText ? `正在提高精度 · 暂定位置 · ${accuracyText}` : '正在提高定位精度';
    }
    if (isLocating) return '正在自动定位...';
    if (addressSource === 'user_preset' && !locationFix) return '已使用保存的住址';
    if (locationFix?.fixSource === 'last_known') {
      return accuracyText ? `暂定位置 · ${accuracyText}` : '暂定位置';
    }
    if (lowAccuracy) return accuracyText ? `大概位置 · ${accuracyText}` : '大概位置';
    return accuracyText ? `已定位 · ${accuracyText}` : '已获取当前位置';
  })();
  const locationNeedsAttention =
    addressSource !== 'manual' &&
    (lowAccuracy || (addressSource === 'user_preset' && !locationFix));

  const sendEmergency = async () => {
    const fixSnapshot = locationFixRef.current;
    if (!fixSnapshot && !combinedAddress) {
      setSendError('请先确认求助位置。');
      return;
    }

    locationAbortRef.current?.abort();
    setIsLocating(false);
    setSendStage('sending');
    setSendError('');
    try {
      const response = await helpApi.emergency({
        latitude: fixSnapshot?.latitude,
        longitude: fixSnapshot?.longitude,
        accuracyMeters: fixSnapshot?.accuracyMeters ?? undefined,
        locationCapturedAt: fixSnapshot
          ? new Date(fixSnapshot.capturedAt).toISOString()
          : undefined,
        fixSource: fixSnapshot?.fixSource,
        precisionAuthorization: fixSnapshot?.precisionAuthorization,
        addressText: combinedAddress || undefined,
        addressSource: addressSource ?? undefined,
        addressConfirmed: addressSource === 'manual',
      });
      setResult(response);
      if (response.deliveryStatus === 'sent') {
        setSendStage('sent');
      } else if (response.deliveryStatus === 'partial') {
        setSendStage('partial');
        setSendError(response.message);
      } else {
        setSendStage('error');
        setSendError(response.message);
      }
    } catch (error: any) {
      setSendError(
        error?.response?.data?.message ??
          '求助发送失败，请检查网络后重试或直接联系紧急联系人。',
      );
      setSendStage('error');
    }
  };

  const sosHint = canSend
    ? isLocating
      ? '可立即发送，定位仍在后台优化'
      : '点击后立即通知所有紧急联系人'
    : isLocating
      ? '正在获取可用位置...'
      : '请先填写求助位置';
  const deliveryFinished = sendStage === 'sent' || sendStage === 'partial';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar
        variant="danger"
        title="紧急求助"
        showMascot={false}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {deliveryFinished && result ? (
          <View style={styles.sentHero}>
            <View style={styles.sentCircle}>
              <Text style={styles.sentCheck}>{sendStage === 'sent' ? '✓' : '!'}</Text>
            </View>
            <Text style={styles.sentTitle}>
              {sendStage === 'sent' ? '求助短信已提交' : '部分求助短信已提交'}
            </Text>
            <Text style={styles.sentSubtitle}>
              {sendStage === 'sent'
                ? '短信服务商已接受全部发送请求'
                : '部分短信发送失败，请直接联系未送达联系人'}
            </Text>
          </View>
        ) : (
          <View style={styles.sosHero}>
            <Text style={styles.heroTitle}>需要帮助？</Text>
            <Text style={styles.heroSubtitle}>无需等待定位完成，可立即发出求助</Text>
          </View>
        )}

        {!deliveryFinished ? (
          <View style={styles.sosAction}>
            <Animated.View style={[styles.sosRing, { transform: [{ scale: pulse }] }]}>
              <Pressable
                onPress={sendEmergency}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="发送 SOS 给紧急联系人"
                accessibilityHint="发送当前定位和完整求助地址给紧急联系人"
                style={({ pressed }) => [
                  styles.sosButton,
                  pressed && canSend && styles.sosButtonPressed,
                  !canSend && styles.sosButtonDisabled,
                ]}
              >
                {sendStage === 'sending' ? (
                  <ActivityIndicator color={Colors.white} size="large" />
                ) : (
                  <Text style={styles.sosText}>SOS</Text>
                )}
              </Pressable>
            </Animated.View>
            <Text style={styles.sosHint}>{sosHint}</Text>
          </View>
        ) : null}

        <Card style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconWrap}>
              <Text style={styles.locationIcon}>⌖</Text>
            </View>
            <View style={styles.locationHeading}>
              <Text style={styles.locationTitle}>确认求助地址</Text>
              <Text
                style={[
                  styles.locationMeta,
                  locationNeedsAttention && styles.locationMetaWarn,
                ]}
              >
                {locationMeta}
              </Text>
            </View>
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : !deliveryFinished ? (
              <Pressable onPress={fetchLocation} hitSlop={10}>
                <Text style={styles.refreshText}>重新定位</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.addressEditor}>
            <View style={styles.addressFieldHeader}>
              <Text style={styles.addressFieldLabel}>求助地址</Text>
              <Text style={styles.addressFieldHint}>定位后可直接补充门牌</Text>
            </View>
            <TextInput
              value={roughAddress}
              onChangeText={(value) => {
                setRoughAddress(value);
                updateAddressSource('manual');
                setLocationWarning('');
                setSendError('');
              }}
              editable={!deliveryFinished}
              multiline
              placeholder={
                isLocating
                  ? '定位中；也可立即手动填写位置'
                  : '请输入道路、小区、楼栋和门牌号'
              }
              placeholderTextColor={Colors.gray400}
              accessibilityLabel="求助地址，可补充楼栋门牌房间号"
              style={[
                styles.addressInput,
                deliveryFinished && styles.inputDisabled,
              ]}
            />
          </View>

          {locationWarning ? (
            <View style={styles.locationWarning}>
              <Text style={styles.locationWarningText}>{locationWarning}</Text>
            </View>
          ) : null}
        </Card>

        {sendError ? <Banner variant="danger">{sendError}</Banner> : null}

        {result && result.contactsNotified.length > 0 ? (
          <Card title="短信提交成功" style={styles.contactsCard}>
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

        {result && result.contactsFailed.length > 0 ? (
          <Card title="短信发送失败" style={styles.contactsCard}>
            {result.contactsFailed.map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={styles.contactInfo}>
                  <View style={[styles.contactAvatar, styles.failedContactAvatar]}>
                    <Text style={[styles.contactAvatarText, styles.failedContactText]}>
                      {contact.name[0]}
                    </Text>
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
                  <Text style={styles.contactCallText}>直接拨打</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <Text style={styles.disclaimer}>
          发送成功表示短信服务商已接受请求，不代表联系人已经阅读。
        </Text>

        {deliveryFinished ? (
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
    backgroundColor: '#FFF8F8',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  sosHero: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  sosAction: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  heroTitle: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: FontSizes.sm,
    color: Colors.gray600,
  },
  sosRing: {
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: '#F7C9CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButton: {
    width: 142,
    height: 142,
    borderRadius: 71,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dangerDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 8,
  },
  sosButtonPressed: {
    backgroundColor: Colors.dangerDark,
    transform: [{ scale: 0.96 }],
  },
  sosButtonDisabled: {
    opacity: 0.55,
  },
  sosText: {
    fontSize: 42,
    fontWeight: FontWeights.bold,
    color: Colors.white,
  },
  sosHint: {
    marginTop: Spacing.md,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.dangerDark,
  },
  sentHero: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  sentCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentCheck: {
    fontSize: 44,
    fontWeight: FontWeights.bold,
    color: Colors.danger,
  },
  sentTitle: {
    marginTop: Spacing.md,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.dangerDark,
  },
  sentSubtitle: {
    marginTop: 4,
    fontSize: FontSizes.sm,
    color: Colors.gray600,
  },
  locationCard: {
    gap: 12,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#EDB8BA',
    ...Shadows.sm,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIcon: {
    fontSize: 22,
    fontWeight: FontWeights.bold,
    color: Colors.danger,
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
    color: Colors.gray500,
  },
  locationMetaWarn: {
    color: Colors.dangerDark,
  },
  refreshText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.danger,
  },
  addressEditor: {
    borderWidth: 1,
    borderColor: '#EFC3C5',
    borderRadius: Radius.md,
    backgroundColor: '#FFFDFD',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addressFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  addressFieldLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    color: Colors.dangerDark,
  },
  addressFieldHint: {
    fontSize: 11,
    color: Colors.gray500,
  },
  addressInput: {
    minHeight: 68,
    paddingHorizontal: 0,
    paddingVertical: 4,
    fontSize: FontSizes.base,
    lineHeight: 24,
    fontWeight: FontWeights.medium,
    color: Colors.gray900,
  },
  inputDisabled: {
    color: Colors.gray600,
  },
  locationWarning: {
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locationWarningText: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
    color: Colors.dangerDark,
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
    backgroundColor: Colors.dangerLight,
  },
  contactAvatarText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.danger,
  },
  failedContactAvatar: {
    backgroundColor: Colors.dangerLight,
  },
  failedContactText: {
    color: Colors.danger,
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
    backgroundColor: Colors.danger,
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
