import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Button, Input } from '@/components/ui';
import { StepDots } from '@/components/ui/StepDots';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

export default function BasicInfoScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [locationHint, setLocationHint] = useState('');

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const user = useStore((s) => s.user);

  const handleUseLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('需要定位权限来自动填充地址');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo) {
        const parts = [geo.city, geo.district, geo.street, geo.name].filter(Boolean);
        setAddress(parts.join(''));
        setLocationHint('请补充具体门牌号（如 3 号楼 502），方便紧急联系人和救援准确找到你');
      }
    } catch (err: any) {
      setError('定位失败，请手动输入地址');
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!nickname.trim()) {
      setError('请输入昵称');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await userApi.updateProfile({ nickname, address });
      await userApi.updateOnboarding({
        step: 'contact-setup',
        isOnboarded: false,
      });

      setUser({ ...user, nickname, address } as any);
      setOnboardingStep('contact-setup');
      router.replace('/onboarding/contact-setup');
    } catch (err: any) {
      const message = err.response?.data?.message || '保存失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="注册" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <View style={styles.header}>
          <StepDots current={2} total={5} />
          <Text style={styles.title}>你的安全信息</Text>
          <Text style={styles.subtitle}>紧急时刻，让联系人和 120 快速找到你</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="昵称"
            value={nickname}
            onChangeText={(text) => { setNickname(text); setError(''); }}
            placeholder="你的名字"
            error={error}
          />
          <Input
            label="手机号"
            value={user?.phone ?? ''}
            editable={false}
            onChangeText={() => {}}
            placeholder="—"
          />

          <View>
            <Text style={styles.label}>当前住址（用于紧急定位）</Text>
            <Pressable
              onPress={handleUseLocation}
              disabled={locating}
              style={({ pressed }) => [
                styles.locationBtn,
                pressed && { backgroundColor: Colors.primaryLight },
              ]}
            >
              {locating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.locationBtnText}>使用当前定位</Text>
              )}
            </Pressable>
            <Input
              label=""
              value={address}
              onChangeText={(text) => { setAddress(text); setLocationHint(''); }}
              placeholder="如：朝阳区XX路XX号 3号楼502"
            />
            {locationHint ? (
              <Text style={styles.locationHint}>{locationHint}</Text>
            ) : null}
            <Text style={styles.addressNote}>
              请写到具体门牌号，方便紧急联系人和 120 准确定位。地址信息可发送给联系人。
            </Text>
          </View>

          <Text style={styles.hint}>
            地址信息仅用于紧急情况，我们会严格保护你的隐私。
          </Text>
        </View>

        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit}
          loading={loading}
          disabled={!nickname.trim()}
          style={styles.button}
        >
          下一步
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg },
  header: { marginBottom: Spacing.xl },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900 },
  subtitle: { fontSize: FontSizes.sm, color: Colors.gray600, marginTop: 6 },
  form: { gap: Spacing.md, marginBottom: Spacing.xl },
  label: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium, color: Colors.gray700, marginBottom: 6 },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 8,
    backgroundColor: Colors.white,
    marginBottom: 8,
  },
  locationBtnText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  locationHint: { fontSize: FontSizes.xs, color: Colors.warm, fontWeight: FontWeights.medium, marginTop: 4 },
  addressNote: { fontSize: FontSizes.xs, color: Colors.gray500, marginTop: 4, lineHeight: 18 },
  hint: { fontSize: FontSizes.xs, color: Colors.gray500, lineHeight: 18 },
  button: { marginTop: 'auto' },
});
