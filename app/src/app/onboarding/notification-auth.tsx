import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Banner, Dialog } from '@/components/ui';
import { StepDots } from '@/components/ui/StepDots';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { MascotLogo } from '@/components/ui/MascotLogo';
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
          <View style={styles.logoWrap}>
            <MascotLogo size="lg" variant="double-bar" />
          </View>
          <Text style={styles.title}>开启每日平安提醒</Text>
          <Text style={styles.description}>
            到点收到提醒后，直接点通知里的「今天还好」，就会完成当天签到。
          </Text>
        </View>

        <View style={styles.previewSection}>
          <View style={styles.notifCard}>
            <View style={styles.notifHeader}>
              <View style={styles.notifBrand}>
                <MascotLogo size="sm" variant="double-bar" />
                <Text style={styles.notifApp}>今天还好</Text>
              </View>
              <Text style={styles.notifTime}>现在</Text>
            </View>
            <Text style={styles.notifTitle}>今天还好吗？</Text>
            <Text style={styles.notifBody}>点一下完成今日平安签到，不用再打开 App。</Text>
            <View style={styles.actionPill}>
              <Text style={styles.actionPillText}>今天还好</Text>
            </View>
          </View>
        </View>

        {authDenied && (
          <Banner variant="danger" style={styles.warning}>
            不授权将无法收到每日平安提醒。
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
          message={'不授权将无法收到每日"今天还好吗？"提醒，也不能通过系统通知一键签到。'}
          confirmText="去授权"
          cancelText="暂不授权"
          variant="default"
          onConfirm={handleRetryAuth}
          onCancel={handleContinueWithoutAuth}
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
  logoWrap: {
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900, marginBottom: Spacing.sm, textAlign: 'center' },
  description: { fontSize: FontSizes.base, color: Colors.gray600, textAlign: 'center', lineHeight: 22 },
  previewSection: { marginBottom: Spacing.lg },
  notifCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  notifBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifApp: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark },
  notifTime: { fontSize: 11, color: Colors.gray500 },
  notifTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.gray900, marginBottom: 4 },
  notifBody: { fontSize: FontSizes.sm, color: Colors.gray600, lineHeight: 20 },
  actionPill: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  actionPillText: { color: Colors.white, fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  warning: { marginBottom: Spacing.lg },
  buttons: { gap: Spacing.md, marginTop: 'auto' },
});
