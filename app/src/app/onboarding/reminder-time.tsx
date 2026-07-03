import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { reminderApi, userApi } from '@/services/api.types';

const TIME_PRESETS = [
  { label: '傍晚', startTime: '18:00', endTime: '20:00' },
  { label: '晚上', startTime: '20:00', endTime: '22:00' },
  { label: '睡前', startTime: '21:00', endTime: '23:00' },
];

export default function ReminderTimeScreen() {
  const router = useRouter();
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('22:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setReminder, setOnboardingStep } = useStore();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      await reminderApi.updateConfig({ startTime, endTime });
      await userApi.updateOnboarding({
        step: 'notification-auth',
        isOnboarded: false,
      });

      setReminder({ startTime, endTime, gracePeriodMin: 30 });
      setOnboardingStep('notification-auth');
      router.replace('/onboarding/notification-auth');
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
          <Text style={styles.stepIndicator}>4 / 5</Text>
          <Text style={styles.title}>每天什么时候问你？</Text>
        </View>

        {/* Time picker */}
        <Card style={styles.timeCard}>
          <Text style={styles.timeLabel}>提醒时间窗口</Text>
          <View style={styles.timeRow}>
            <View style={styles.timePicker}>
              <Text style={styles.timeValue}>{startTime}</Text>
              <Text style={styles.timeHint}>开始</Text>
            </View>
            <Text style={styles.separator}>至</Text>
            <View style={styles.timePicker}>
              <Text style={styles.timeValue}>{endTime}</Text>
              <Text style={styles.timeHint}>结束</Text>
            </View>
          </View>
        </Card>

        <View style={styles.presetRow}>
          {TIME_PRESETS.map((preset) => {
            const active = startTime === preset.startTime && endTime === preset.endTime;
            return (
              <Pressable
                key={preset.label}
                onPress={() => {
                  setStartTime(preset.startTime);
                  setEndTime(preset.endTime);
                }}
                style={[styles.presetButton, active && styles.presetButtonActive]}
              >
                <Text style={[styles.presetLabel, active && styles.presetLabelActive]}>
                  {preset.label}
                </Text>
                <Text style={[styles.presetTime, active && styles.presetTimeActive]}>
                  {preset.startTime} - {preset.endTime}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Hint card */}
        <Card variant="info" style={styles.hintCard}>
          <Text style={styles.hintText}>
            如果 {endTime} 前没回复，系统会先温和提醒你，再给 30 分钟宽限期，之后才通知联系人。
          </Text>
        </Card>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {/* Submit button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit}
          loading={loading}
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
  timeCard: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  presetButton: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  presetButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  presetLabel: {
    fontSize: FontSizes.sm,
    color: Colors.gray700,
    fontWeight: FontWeights.semibold,
    marginBottom: 4,
  },
  presetLabelActive: {
    color: Colors.primaryDark,
  },
  presetTime: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
  },
  presetTimeActive: {
    color: Colors.primaryDark,
  },
  timeLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  timePicker: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
  },
  timeValue: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.primaryDark,
  },
  timeHint: {
    fontSize: FontSizes.sm,
    color: Colors.primaryDark,
    marginTop: Spacing.xs,
  },
  separator: {
    fontSize: FontSizes.lg,
    color: Colors.gray600,
    fontWeight: FontWeights.medium,
  },
  hintCard: {
    marginBottom: Spacing.xl,
  },
  hintText: {
    fontSize: FontSizes.sm,
    color: Colors.gray700,
    lineHeight: 20,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  button: {
    marginTop: 'auto',
  },
});
