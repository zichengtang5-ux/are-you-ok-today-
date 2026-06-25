import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>1 / 5</Text>
          <Text style={styles.title}>请阅读并同意</Text>
        </View>

        {/* Warning banner */}
        <Card variant="warm" style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>请特别注意以下条款</Text>
        </Card>

        {/* Agreement items */}
        <View style={styles.agreementList}>
          <Card style={styles.agreementItem}>
            <Text style={styles.agreementTitle}>免责条款</Text>
            <Text style={styles.agreementText}>
              本产品为辅助守护工具，不替代专业医疗/急救服务。本产品不保证在所有情况下都能成功通知联系人。
            </Text>
          </Card>

          <Card style={styles.agreementItem}>
            <Text style={styles.agreementTitle}>数据使用说明</Text>
            <Text style={styles.agreementText}>
              回复时间、联系人信息、短信记录将被安全存储，仅用于守护服务。
            </Text>
          </Card>

          <Card style={styles.agreementItem}>
            <Text style={styles.agreementTitle}>用户协议与隐私政策</Text>
            <Text style={styles.agreementText}>
              使用服务即表示你已阅读并同意用户协议和隐私政策的全部内容。
            </Text>
          </Card>
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
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  warningIcon: {
    fontSize: FontSizes.md,
  },
  warningText: {
    fontSize: FontSizes.base,
    color: Colors.warmDark,
    fontWeight: FontWeights.semibold,
  },
  agreementList: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  agreementItem: {
    gap: Spacing.sm,
  },
  agreementTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  agreementText: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: FontWeights.bold,
  },
  checkboxLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray800,
    flex: 1,
  },
  button: {
    marginTop: 'auto',
  },
});
