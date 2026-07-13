import { useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Input, Button } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { userApi } from '@/services/api.types';
import { isOfflineDevSession } from '@/services/devMock';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

export default function DeleteConfirmScreen() {
  const router = useRouter();
  const subscription = useStore((state) => state.subscription);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const clearLocalAccount = async () => {
    useStore.getState().resetAppState();
    await AsyncStorage.multiRemove([
      'access_token',
      'refresh_token',
      'today-ok-storage',
    ]);
    router.replace('/onboarding/login');
  };

  const handleDelete = async () => {
    if (confirmText !== '确认删除' || submitting) return;
    setSubmitting(true);
    try {
      await userApi.deleteAccount(confirmText);
      await clearLocalAccount();
    } catch (err: any) {
      if (await isOfflineDevSession()) {
        await clearLocalAccount();
        return;
      }
      Alert.alert('删除失败', err.response?.data?.message || err?.message || '请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="删除数据" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <View style={styles.warningSection}>
          <View style={styles.warningIconWrap}>
            <Text style={styles.warningIconText}>!</Text>
          </View>
          <Text style={styles.title}>确定删除所有数据吗？</Text>
          <Text style={styles.description}>
            删除后无法恢复，包括：回复记录、{'\n'}
            联系人信息、守护设置。{'\n'}
            你的紧急联系人将不再收到通知。
          </Text>
          {subscription?.isPremium ? (
            <Text style={styles.subscriptionWarning}>
              删除账号不会自动取消 Apple 订阅，请先在 App Store 管理自动续订。
            </Text>
          ) : null}
        </View>

        {subscription?.isPremium ? (
          <Button
            variant="outline"
            size="md"
            onPress={() => {
              Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {
                Alert.alert('无法打开', '请前往系统设置中的 Apple ID 订阅页面管理。');
              });
            }}
            style={styles.manageSubscriptionButton}
          >
            管理 Apple 订阅
          </Button>
        ) : null}

        <View style={styles.inputSection}>
          <Input
            label='请输入"确认删除"以继续'
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="确认删除"
          />
        </View>

        <Button
          variant="danger"
          size="lg"
          onPress={handleDelete}
          disabled={confirmText !== '确认删除' || submitting}
          style={styles.confirmButton}
        >
          {submitting ? '删除中...' : '确认删除'}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onPress={() => router.back()}
        >
          取消
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg },
  warningSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  warningIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.warmLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.warm,
  },
  warningIconText: {
    fontSize: 28,
    fontWeight: FontWeights.bold,
    color: Colors.warm,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: FontSizes.base,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 24,
  },
  subscriptionWarning: {
    marginTop: Spacing.md,
    fontSize: FontSizes.sm,
    color: Colors.danger,
    textAlign: 'center',
    lineHeight: 20,
  },
  manageSubscriptionButton: {
    marginBottom: Spacing.lg,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  confirmButton: {
    marginBottom: Spacing.md,
  },
});
