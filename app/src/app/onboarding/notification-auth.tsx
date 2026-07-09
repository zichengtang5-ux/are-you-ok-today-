import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Banner, Dialog } from '@/components/ui';
import { StepDots } from '@/components/ui/StepDots';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api.types';
import { requestNotificationPermission, scheduleDailyReminder, registerDeviceToken } from '@/services/notifications';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

export default function NotificationAuthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authDenied, setAuthDenied] = useState(false);
  const [showDeniedDialog, setShowDeniedDialog] = useState(false);

  const { reminder, setOnboardingStep, setNotificationAuthorized, completeOnboarding } = useStore();

  const handleAuthorize = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationAuthorized(true);
        await userApi.updateProfile({ notificationAuth: true });
        await scheduleDailyReminder(reminder.startTime, reminder.endTime);
        registerDeviceToken().catch(() => {});
        await userApi.updateOnboarding({ step: 'complete', isOnboarded: true });
        completeOnboarding();
        setOnboardingStep('complete');
        router.replace('/onboarding/complete');
      } else {
        setAuthDenied(true);
        setShowDeniedDialog(true);
      }
    } catch (error) {
      console.error('Notification permission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => { setShowDeniedDialog(true); };

  const handleContinueWithoutAuth = async () => {
    setLoading(true);
    try {
      setNotificationAuthorized(false);
      setShowDeniedDialog(false);
      await userApi.updateOnboarding({ step: 'complete', isOnboarded: true });
      completeOnboarding();
      setOnboardingStep('complete');
      router.replace('/onboarding/complete');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAuth = () => { setShowDeniedDialog(false); handleAuthorize(); };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="注册" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <View style={styles.header}>
          <StepDots current={5} total={5} />
        </View>

        <View style={styles.hero}>
          <View style={styles.illustrationWrap}>
            <View style={styles.bellBody}>
              <View style={styles.bellTop} />
              <View style={styles.bellClapper} />
            </View>
          </View>
          <Text style={styles.title}>允许发送提醒消息</Text>
          <Text style={styles.description}>
            我们需要通知权限，才能在每天设定的时间询问你"今天还好吗？"
          </Text>
        </View>

        {/* Notification preview cards */}
        <View style={styles.previewSection}>
          <View style={styles.notifCard}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifApp}>今天还好</Text>
              <Text style={styles.notifTime}>现在</Text>
            </View>
            <Text style={styles.notifTitle}>今天还好吗？</Text>
            <Text style={styles.notifBody}>点击回复"还好"，或长按回复更多信息</Text>
          </View>
          <View style={styles.notifCard}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifApp}>今天还好</Text>
              <Text style={styles.notifTime}>超时后</Text>
            </View>
            <Text style={styles.notifTitle}>! 还没回复，确认安全吗？</Text>
            <Text style={styles.notifBody}>如不回复，30 分钟后将通知你的紧急联系人</Text>
          </View>
        </View>

        {authDenied && (
          <Banner variant="danger" style={styles.warning}>
            不授权将无法收到每日平安提醒，守护功能将无法正常工作。
          </Banner>
        )}

        <View style={styles.buttons}>
          <Button variant="primary" size="lg" onPress={handleAuthorize} loading={loading}>
            允许发送提醒
          </Button>
          <Button variant="ghost" size="md" onPress={handleSkip}>
            暂不授权
          </Button>
        </View>

        <Dialog
          visible={showDeniedDialog}
          title="确定不授权吗？"
          message={'不授权将无法收到每日"今天还好吗？"提醒，守护功能将无法正常工作。'}
          confirmText="仍然不授权"
          cancelText="去授权"
          variant="warm"
          onConfirm={handleContinueWithoutAuth}
          onCancel={handleRetryAuth}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg },
  header: { marginBottom: Spacing.lg },
  hero: { alignItems: 'center', marginBottom: Spacing.lg },
  illustrationWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  bellBody: {
    alignItems: 'center',
  },
  bellTop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  bellClapper: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 2,
  },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900, marginBottom: Spacing.sm, textAlign: 'center' },
  description: { fontSize: FontSizes.base, color: Colors.gray600, textAlign: 'center', lineHeight: 22 },
  previewSection: { gap: Spacing.sm, marginBottom: Spacing.lg },
  notifCard: {
    backgroundColor: Colors.gray100,
    borderRadius: Radius.md,
    padding: 12,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  notifApp: { fontSize: 12, fontWeight: '600', color: Colors.gray700 },
  notifTime: { fontSize: 11, color: Colors.gray500 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: Colors.gray900, marginBottom: 2 },
  notifBody: { fontSize: 13, color: Colors.gray600 },
  warning: { marginBottom: Spacing.lg },
  buttons: { gap: Spacing.md, marginTop: 'auto' },
});
