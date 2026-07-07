import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { reminderApi, userApi } from '@/services/api.types';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);

function getHour(time: string): number {
  return Number(time.slice(0, 2));
}

export default function ReminderTimeScreen() {
  const router = useRouter();
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('22:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setReminder, setOnboardingStep } = useStore();

	  const handleSubmit = async () => {
    if (getHour(endTime) <= getHour(startTime)) {
      setError('结束时间必须晚于开始时间');
      return;
    }

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

  const handleStartSelect = (time: string) => {
    const hour = getHour(time);
    if (hour >= 23) return;
    setStartTime(time);
    if (getHour(endTime) <= hour) {
      setEndTime(HOUR_OPTIONS[hour + 1]);
    }
    setError('');
  };

  const handleEndSelect = (time: string) => {
    if (getHour(time) <= getHour(startTime)) return;
    setEndTime(time);
    setError('');
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
            <View style={styles.timeColumn}>
              <Text style={styles.timeHint}>开始</Text>
              <ScrollView style={styles.hourList} showsVerticalScrollIndicator={false}>
                {HOUR_OPTIONS.slice(0, 23).map((time) => {
                  const active = time === startTime;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => handleStartSelect(time)}
                      style={[styles.hourOption, active && styles.hourOptionActive]}
                    >
                      <Text style={[styles.hourText, active && styles.hourTextActive]}>
                        {time}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Text style={styles.separator}>至</Text>
            <View style={styles.timeColumn}>
              <Text style={styles.timeHint}>结束</Text>
              <ScrollView style={styles.hourList} showsVerticalScrollIndicator={false}>
                {HOUR_OPTIONS.slice(1).map((time) => {
                  const disabled = getHour(time) <= getHour(startTime);
                  const active = time === endTime;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => handleEndSelect(time)}
                      disabled={disabled}
                      style={[
                        styles.hourOption,
                        active && styles.hourOptionActive,
                        disabled && styles.hourOptionDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.hourText,
                          active && styles.hourTextActive,
                          disabled && styles.hourTextDisabled,
                        ]}
                      >
                        {time}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Card>

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
  timeColumn: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hourList: {
    width: 116,
    maxHeight: 188,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
  },
  timeHint: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    fontWeight: FontWeights.medium,
  },
  hourOption: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourOptionActive: {
    backgroundColor: Colors.primaryLight,
  },
  hourOptionDisabled: {
    opacity: 0.4,
  },
  hourText: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
  },
  hourTextActive: {
    color: Colors.primaryDark,
    fontWeight: FontWeights.bold,
  },
  hourTextDisabled: {
    color: Colors.gray400,
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
