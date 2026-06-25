import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card, Banner, Dialog } from '@/components/ui';
import { useStore } from '@/store/useStore';
import { userApi } from '@/services/api.types';
import { requestNotificationPermission, scheduleDailyReminder, getNotificationStatus } from '@/services/notifications';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';

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

        // Schedule daily reminder
        await scheduleDailyReminder(reminder.startTime, reminder.endTime);

        await userApi.updateOnboarding({
          step: 'complete',
          isOnboarded: true,
        });

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

  const handleSkip = () => {
    setShowDeniedDialog(true);
  };

  const handleContinueWithoutAuth = async () => {
    setLoading(true);

    try {
      setNotificationAuthorized(false);
      setShowDeniedDialog(false);

      await userApi.updateOnboarding({
        step: 'complete',
        isOnboarded: true,
      });

      completeOnboarding();
      setOnboardingStep('complete');
      router.replace('/onboarding/complete');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAuth = () => {
    setShowDeniedDialog(false);
    handleAuthorize();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>5 / 5</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.illustration}>🔔</Text>
          <Text style={styles.title}>允许发送提醒消息</Text>
          <Text style={styles.description}>
            我们需要通知权限，才能在每天设定的时间询问你"今天还好吗？"
          </Text>
        </View>

        {/* Warning */}
        {authDenied && (
          <Banner variant="danger" style={styles.warning}>
            不授权将无法收到每日平安提醒，守护功能将无法正常工作。
          </Banner>
        )}

        {/* Buttons */}
        <View style={styles.buttons}>
          <Button variant="primary" size="lg" onPress={handleAuthorize} loading={loading}>
            允许发送提醒
          </Button>
          <Button variant="ghost" size="md" onPress={handleSkip}>
            暂不授权
          </Button>
        </View>

        {/* Denied confirmation dialog */}
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
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  stepIndicator: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    fontWeight: FontWeights.medium,
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  illustration: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  warning: {
    marginBottom: Spacing.lg,
  },
  buttons: {
    gap: Spacing.md,
  },
});
