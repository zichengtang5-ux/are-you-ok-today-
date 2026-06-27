import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Button, Input } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

export default function EditAddressScreen() {
  const router = useRouter();
  const { user, setUser } = useStore();

  const [address, setAddress] = useState(user?.address ?? '');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [locationHint, setLocationHint] = useState('');

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

  const handleSave = async () => {
    if (!address.trim()) {
      setError('请输入地址');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await userApi.updateProfile({ address });
      setUser({ ...user, address } as any);
      router.back();
    } catch (err: any) {
      setError(err.response?.data?.message || '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="编辑地址" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.pageTitle}>当前住址</Text>
        <Text style={styles.pageSubtitle}>紧急联系人和 120 可通过此地址快速定位你的位置</Text>

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
          onChangeText={(text) => { setAddress(text); setLocationHint(''); setError(''); }}
          placeholder="如：朝阳区XX路XX号 3号楼502"
          error={error}
        />

        {locationHint ? (
          <Text style={styles.locationHint}>{locationHint}</Text>
        ) : null}

        <Text style={styles.note}>
          请写到具体门牌号，方便紧急联系人和救援准确定位。地址信息可发送给联系人。
        </Text>

        <Button
          variant="primary"
          size="lg"
          onPress={handleSave}
          loading={loading}
          style={styles.button}
        >
          保存
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg },
  pageTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.gray900, marginBottom: 4 },
  pageSubtitle: { fontSize: FontSizes.sm, color: Colors.gray600, marginBottom: Spacing.lg },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 8,
    backgroundColor: Colors.white,
    marginBottom: Spacing.md,
  },
  locationBtnText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  locationHint: { fontSize: FontSizes.xs, color: Colors.warm, fontWeight: FontWeights.medium, marginTop: 4 },
  note: { fontSize: FontSizes.xs, color: Colors.gray500, lineHeight: 18, marginTop: Spacing.sm },
  button: { marginTop: 'auto' },
});
