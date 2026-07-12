import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Dialog } from '@/components/ui';
import { StepDots } from '@/components/ui/StepDots';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { MascotLogo } from '@/components/ui/MascotLogo';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api.types';
import { requestNotificationPermission, scheduleDailyReminder, registerDeviceToken } from '@/services/notifications';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { isOfflineDevSession } from '@/services/devMock';

export default function NotificationAuthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authDenied, setAuthDenied] = useState(false);
  const [showDeniedDialog, setShowDeniedDialog] = useState(false);

  const { reminder, user, setOnboardingStep, setNotificationAuthorized, completeOnboarding } = useStore();
  const notificationTitle = `「${user?.nickname?.trim() || '你'}」今天还好吗？`;

  const handleBack = () => {
    setOnboardingStep('reminder-time');
    router.replace('/onboarding/reminder-time');
  };

  const handleAuthorize = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationAuthorized(true);
        await userApi.updateProfile({ notificationAuth: true });
        await scheduleDailyReminder(reminder.startTime, reminder.endTime, user?.nickname);
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
      if (await isOfflineDevSession()) {
        completeOnboarding();
        setOnboardingStep('complete');
        router.replace('/onboarding/complete');
      } else {
        console.error('Notification permission error:', error);
      }
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
      if (await isOfflineDevSession()) {
        completeOnboarding();
        setOnboardingStep('complete');
        router.replace('/onboarding/complete');
      } else {
        console.error('Failed to complete onboarding:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAuth = () => { setShowDeniedDialog(false); handleAuthorize(); };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="primary" title="通知授权" showMascot onBack={handleBack} />
      <View style={styles.content}>
        <View style={styles.header}>
          <StepDots current={4} total={4} />
        </View>

        <View style={styles.dialogCard}>
          <View style={styles.logoWrap}>
            <MascotLogo size="md" variant="double-bar" />
          </View>
          <Text style={styles.eyebrow}>系统通知授权</Text>
          <Text style={styles.title}>打开提醒，一键报平安</Text>
          <Text style={styles.description}>
            到点收到系统通知后，点通知可回到首页，点「今天还好」即可完成当天签到。
          </Text>

          <View style={styles.systemPreview}>
            <View style={styles.systemHandle} />
            <View style={styles.notifCard}>
              <View style={styles.notifHeader}>
                <View style={styles.notifBrand}>
                  <View style={styles.notifLogo}>
                    <MascotLogo size="sm" variant="double-bar" />
                  </View>
                  <Text style={styles.notifApp}>今天还好</Text>
                </View>
                <Text style={styles.notifTime}>现在</Text>
              </View>
              <Text style={styles.notifTitle}>{notificationTitle}</Text>
              <Text style={styles.notifBody}>一键点击，让我知道你今天还好</Text>
              <View style={styles.notificationActions}>
                <View style={styles.actionPill}>
                  <Text style={styles.actionPillText}>今天还好</Text>
                </View>
                <View style={styles.secondaryPill}>
                  <Text style={styles.secondaryPillText}>打开应用</Text>
                </View>
              </View>
            </View>
          </View>

          {authDenied && (
            <View style={styles.warning}>
              <Text style={styles.warningText}>不授权将无法收到每日提醒，也不能从通知一键签到。</Text>
            </View>
          )}

          <View style={styles.buttons}>
            <Button variant="primary" size="lg" onPress={handleAuthorize} loading={loading}>
              允许通知并开启
            </Button>
            <Button variant="ghost" size="md" onPress={handleSkip}>
              稍后再说
            </Button>
          </View>
        </View>

        <Dialog
          visible={showDeniedDialog}
          title="确定不授权吗？"
          message="不授权将无法收到每日报平安提醒，也不能通过系统通知一键签到。"
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
  container: { flex: 1, backgroundColor: Colors.primary },
  content: { flex: 1, padding: Spacing.lg, justifyContent: 'center' },
  header: { marginBottom: Spacing.lg },
  dialogCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 12,
  },
  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -52,
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  eyebrow: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.bold, marginBottom: 6 },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900, marginBottom: Spacing.sm, textAlign: 'center' },
  description: { fontSize: FontSizes.base, color: Colors.gray600, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
  systemPreview: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#E8F5EA',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  systemHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  notifCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  notifBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifLogo: { width: 26, height: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  notifApp: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark },
  notifTime: { fontSize: 11, color: Colors.gray500 },
  notifTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.gray900, marginBottom: 4 },
  notifBody: { fontSize: FontSizes.sm, color: Colors.gray600, lineHeight: 20 },
  notificationActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  actionPill: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  actionPillText: { color: Colors.white, fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  secondaryPill: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  secondaryPillText: { color: Colors.primaryDark, fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  warning: {
    width: '100%',
    backgroundColor: Colors.warmLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  warningText: { color: Colors.warmDark, fontSize: FontSizes.sm, textAlign: 'center', fontWeight: FontWeights.medium },
  buttons: { width: '100%', gap: Spacing.sm },
});
