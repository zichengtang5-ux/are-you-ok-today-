import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Button, Input } from '@/components/ui';
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

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);

  const handleLocate = async () => {
    if (locating) return;
    setLocating(true);
    setError('');

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setError('定位权限未开启，请手动填写地址');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const locatedAddress = place
        ? [place.region, place.city, place.district, place.street, place.name]
            .filter(Boolean)
            .join('')
        : '';

      setAddress(
        locatedAddress ||
          `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
      );
    } catch {
      setError('定位失败，请手动填写地址');
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

      setUser({ nickname, address } as any);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>2 / 5</Text>
          <Text style={styles.title}>告诉我们你是谁</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="昵称"
            value={nickname}
            onChangeText={(text) => {
              setNickname(text);
              setError('');
            }}
            placeholder="你的名字"
            error={error}
          />
          <Input
            label="当前住址（用于紧急定位）"
            value={address}
            onChangeText={setAddress}
            placeholder="如：北京市朝阳区XX路XX号"
          />
          <Button
            variant="outline"
            size="md"
            onPress={handleLocate}
            loading={locating}
            disabled={locating}
          >
            使用当前位置
          </Button>
          <Text style={styles.hint}>
            地址信息仅用于紧急情况，我们会严格保护你的隐私。
          </Text>
        </View>

        {/* Submit button */}
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
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  stepIndicator: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    lineHeight: 18,
  },
  button: {
    marginTop: 'auto',
  },
});
