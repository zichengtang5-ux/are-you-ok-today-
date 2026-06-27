import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { StepDots } from '@/components/ui/StepDots';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

export default function AgreementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const setOnboardingStep = useStore((s) => s.setOnboardingStep);

  const handleAgree = async () => {
    setLoading(true);

    try {
      await userApi.updateOnboarding({
        step: 'basic-info',
        isOnboarded: false,
      });

      setOnboardingStep('basic-info');
      router.replace('/onboarding/basic-info');
    } catch (error) {
      console.error('Failed to update onboarding step:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="注册" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <StepDots current={1} total={5} />
          <Text style={styles.title}>请阅读并同意</Text>
          <Text style={styles.subtitle}>这些条款保护你和我们的权益</Text>
        </View>

        {/* Warning banner */}
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>⚠️ 请特别注意以下条款</Text>
        </View>

        {/* Agreement items as checkbox rows */}
        <View style={styles.agreementList}>
          <Pressable style={styles.checkRow} onPress={() => {}}>
            <View style={styles.checkLabel}>
              <Text style={styles.checkTitle}>免责条款</Text>
              <Text style={styles.checkText}>
                本产品为辅助守护工具，<Text style={styles.redBold}>不替代专业医疗/急救服务</Text>。不保证在所有情况下都能成功通知联系人。
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.checkRow} onPress={() => {}}>
            <View style={styles.checkLabel}>
              <Text style={styles.checkTitle}>数据使用说明</Text>
              <Text style={styles.checkText}>
                回复时间、联系人信息、短信记录将被<Text style={styles.redBold}>安全存储</Text>，仅用于守护服务。
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.checkRow} onPress={() => {}}>
            <View style={styles.checkLabel}>
              <Text style={styles.checkTitle}>用户协议与隐私政策</Text>
              <Text style={styles.checkText}>
                使用服务即表示你已阅读并同意用户协议和隐私政策的全部内容。
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Checkbox */}
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setAgreed(!agreed)}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>我已阅读并同意上述所有条款</Text>
        </Pressable>

        {/* Submit button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleAgree}
          loading={loading}
          disabled={!agreed}
          style={styles.button}
        >
          同意并继续
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg },
  header: { marginBottom: Spacing.lg },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900 },
  subtitle: { fontSize: FontSizes.sm, color: Colors.gray600, marginTop: 6 },
  alertBanner: {
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.warmLight,
    marginBottom: Spacing.lg,
  },
  alertText: { fontSize: FontSizes.sm, color: Colors.warmDark, fontWeight: FontWeights.semibold },
  agreementList: { gap: Spacing.md, marginBottom: Spacing.lg },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: Colors.gray100,
    borderRadius: Radius.sm,
  },
  checkLabel: { flex: 1 },
  checkTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.gray900, marginBottom: 4 },
  checkText: { fontSize: 13, color: Colors.gray700, lineHeight: 20 },
  redBold: { color: Colors.danger, fontWeight: FontWeights.bold },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: Colors.white, fontSize: 16, fontWeight: FontWeights.bold },
  checkboxLabel: { fontSize: FontSizes.base, color: Colors.gray800, flex: 1 },
  button: { marginTop: 'auto' },
});
