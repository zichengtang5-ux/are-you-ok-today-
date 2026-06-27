import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
  const [error, setError] = useState('');

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const user = useStore((s) => s.user);

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
          <Input
            label="当前住址（用于紧急定位）"
            value={address}
            onChangeText={setAddress}
            placeholder="如：北京市朝阳区XX路XX号"
          />
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
  hint: { fontSize: FontSizes.xs, color: Colors.gray500, lineHeight: 18 },
  button: { marginTop: 'auto' },
});
