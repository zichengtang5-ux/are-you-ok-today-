import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Card, Button, Banner } from '@/components/ui';
import { helpApi, type EmergencyHelpResponse } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius, Shadows } from '@/theme';

type Stage = 'preparing' | 'ready' | 'sending' | 'sent' | 'error';

function maskPhone(phone: string): string {
  if (phone.length >= 7) return phone.slice(0, 3) + '****' + phone.slice(-4);
  return phone;
}

export default function EmergencyHelpScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('preparing');
  const [address, setAddress] = useState<string>('');
  const [addressSource, setAddressSource] = useState<'gps' | 'user_preset' | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<EmergencyHelpResponse | null>(null);
  const pulse = useState(new Animated.Value(1))[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const fetchLocation = useCallback(async () => {
    setStage('preparing');
    setErrorMsg('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const preset = await helpApi.getAddress().catch(() => null);
        if (preset?.address) {
          setAddress(preset.address);
          setAddressSource(preset.source);
          setStage('ready');
        } else {
          setErrorMsg('无法获取位置信息，请手动拨打紧急电话');
          setStage('error');
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });

      const reverse = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      }).catch(() => []);

      const formatted = reverse[0]
        ? [reverse[0].street, reverse[0].district, reverse[0].city]
            .filter(Boolean)
            .join(' ')
        : '';

      if (formatted) {
        setAddress(formatted);
        setAddressSource('gps');
      } else {
        const preset = await helpApi.getAddress().catch(() => null);
        setAddress(preset?.address ?? '当前位置无法解析');
        setAddressSource(preset?.source ?? 'gps');
      }
      setStage('ready');
    } catch (e: any) {
      setErrorMsg(e?.message ?? '获取位置失败');
      setStage('error');
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const sendEmergency = async () => {
    setStage('sending');
    try {
      const res = await helpApi.emergency({
        latitude: coords?.lat,
        longitude: coords?.lon,
        addressText: address,
      });
      setResult(res);
      setStage('sent');
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.message ?? e?.message ?? '求助发送失败');
      setStage('error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>紧急求助</Text>
        <Text style={styles.subtitle}>一键通知所有紧急联系人</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* SOS Button (pre-send) */}
        {stage !== 'sent' && (
          <View style={styles.hero}>
            <Animated.View style={[styles.sosRing, { transform: [{ scale: pulse }] }]}>
              <Pressable
                onPress={sendEmergency}
                disabled={stage !== 'ready'}
                style={[styles.sosButton, stage !== 'ready' && styles.sosDisabled]}
              >
                {stage === 'preparing' || stage === 'sending' ? (
                  <ActivityIndicator color={Colors.white} size="large" />
                ) : (
                  <Text style={styles.sosText}>SOS</Text>
                )}
              </Pressable>
            </Animated.View>
            <Text style={styles.sosHint}>
              {stage === 'preparing' && '正在定位...'}
              {stage === 'ready' && '点击发送求助信号'}
              {stage === 'sending' && '正在通知联系人...'}
              {stage === 'error' && '请重试或手动拨号'}
            </Text>
          </View>
        )}

        {/* Sent state */}
        {stage === 'sent' && result && (
          <View style={styles.hero}>
            <View style={styles.successCircle}>
              <Text style={styles.successEmoji}>✓</Text>
            </View>
            <Text style={styles.successTitle}>求助已发出</Text>
            <Text style={styles.successSub}>{result.message}</Text>
          </View>
        )}

        {/* Location card */}
        <Card style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Text style={styles.locationIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>
                {stage === 'sent' ? '求助位置' : '当前位置'}
              </Text>
              {addressSource && (
                <Text style={styles.locationSource}>
                  {addressSource === 'gps' ? 'GPS 实时定位' : '预设地址'}
                </Text>
              )}
            </View>
            {stage === 'preparing' && (
              <ActivityIndicator size="small" color={Colors.primary} />
            )}
            {stage === 'ready' && (
              <Pressable onPress={fetchLocation}>
                <Text style={styles.refreshText}>刷新</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.locationText} numberOfLines={3}>
            {stage === 'preparing' ? '正在获取位置...' : address || '—'}
          </Text>
        </Card>

        {/* Error banner */}
        {stage === 'error' && errorMsg && (
          <Banner variant="danger">{errorMsg}</Banner>
        )}

        {/* Notified contacts (after sent) */}
        {stage === 'sent' && result && result.contactsNotified.length > 0 && (
          <Card title="已通知的联系人" style={styles.contactsCard}>
            {result.contactsNotified.map((c) => (
              <View key={c.id} style={styles.contactRow}>
                <View style={styles.contactInfo}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{c.name[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactPhone}>{maskPhone(c.phone)}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => Linking.openURL(`tel:${c.phone}`)}
                  style={styles.callButton}
                >
                  <Text style={styles.callButtonText}>拨打</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        {/* Quick actions */}
        <Card title="快捷拨号" style={styles.quickCard}>
          <Pressable
            onPress={() => Linking.openURL('tel:120')}
            style={styles.quickRow}
          >
            <Text style={styles.quickIcon}>急救</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickLabel}>120 急救</Text>
              <Text style={styles.quickHint}>危及生命时第一时间拨打</Text>
            </View>
            <Text style={styles.quickArrow}>→</Text>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('tel:110')}
            style={styles.quickRow}
          >
            <Text style={styles.quickIcon}>🚔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickLabel}>110 报警</Text>
              <Text style={styles.quickHint}>遇到危险或治安问题</Text>
            </View>
            <Text style={styles.quickArrow}>→</Text>
          </Pressable>
        </Card>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          按下 SOS 后，系统会向你的所有紧急联系人发送包含你当前位置的求助短信。请仅在真正需要时使用。
        </Text>

        {stage === 'sent' && (
          <Button variant="outline" onPress={() => router.back()} style={styles.backBtn}>
            返回首页
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    marginBottom: Spacing.sm,
  },
  backText: {
    fontSize: FontSizes.base,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  sosRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  sosButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  sosDisabled: {
    opacity: 0.5,
  },
  sosText: {
    fontSize: 48,
    fontWeight: FontWeights.bold,
    color: Colors.white,
    letterSpacing: 2,
  },
  sosHint: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    fontWeight: FontWeights.medium,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  successEmoji: {
    fontSize: 56,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  successTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.xs,
  },
  successSub: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
  },
  locationCard: {
    gap: Spacing.sm,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationIcon: {
    fontSize: 20,
  },
  locationLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  locationSource: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  locationText: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    lineHeight: FontSizes.base * 1.5,
  },
  refreshText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  contactsCard: {
    gap: Spacing.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
  callButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  callButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.white,
  },
  quickCard: {
    gap: Spacing.md,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  quickIcon: {
    fontSize: 24,
  },
  quickLabel: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  quickHint: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  quickArrow: {
    fontSize: FontSizes.lg,
    color: Colors.gray400,
  },
  disclaimer: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: FontSizes.xs * 1.5,
  },
  backBtn: {
    marginTop: Spacing.md,
  },
});
