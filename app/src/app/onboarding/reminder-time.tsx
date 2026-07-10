import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { StepDots } from '@/components/ui/StepDots';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import { useStore } from '@/store/useStore';
import { reminderApi, userApi } from '@/services/api.types';

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function ScrollPicker({ value, options, onChange, label }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const idx = options.indexOf(value);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
  }, [options, value]);

  const handleMomentumEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(options.length - 1, idx));
    const targetY = clamped * ITEM_HEIGHT;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
    if (options[clamped] !== value) {
      onChange(options[clamped]);
    }
  };

  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerWrapper}>
        <View style={styles.pickerHighlight} />
        <ScrollView
          ref={scrollRef}
          style={styles.pickerScroll}
          contentContainerStyle={styles.pickerContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
        >
          <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
          {options.map((opt) => (
            <View key={opt} style={styles.pickerItem}>
              <Text style={[styles.pickerItemText, opt === value && styles.pickerItemTextActive]}>
                {opt}
              </Text>
            </View>
          ))}
          <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
        </ScrollView>
      </View>
    </View>
  );
}

export default function ReminderTimeScreen() {
  const router = useRouter();
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('22:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { setReminder, setOnboardingStep } = useStore();

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const handleSubmit = async () => {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="注册" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <View style={styles.header}>
          <StepDots current={3} total={4} />
          <Text style={styles.title}>每天什么时候问你？</Text>
        </View>

        <Card style={styles.timeCard}>
          <Text style={styles.timeLabel}>提醒时间窗口</Text>
          <View style={styles.pickersRow}>
            <ScrollPicker value={startTime} options={HOURS} onChange={setStartTime} label="开始" />
            <Text style={styles.separator}>至</Text>
            <ScrollPicker value={endTime} options={HOURS} onChange={setEndTime} label="结束" />
          </View>
        </Card>

        <Card variant="info" style={styles.hintCard}>
          <Text style={styles.hintText}>
            如果 {endTime} 前没回复，系统会先温和提醒你，再给 30 分钟宽限期，之后才通知联系人。
          </Text>
        </Card>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

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
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg },
  header: { marginBottom: Spacing.xl },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900 },
  timeCard: { alignItems: 'center', marginBottom: Spacing.lg },
  timeLabel: { fontSize: FontSizes.base, color: Colors.gray700, fontWeight: FontWeights.medium, marginBottom: Spacing.md },
  pickersRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pickerContainer: { alignItems: 'center' },
  pickerLabel: { fontSize: FontSizes.sm, color: Colors.gray600, marginBottom: Spacing.sm },
  pickerWrapper: {
    height: PICKER_HEIGHT,
    width: 96,
    position: 'relative',
    overflow: 'hidden',
  },
  pickerHighlight: {
    position: 'absolute',
    top: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    zIndex: 0,
  },
  pickerScroll: { flex: 1 },
  pickerContent: { alignItems: 'center' },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  pickerItemText: {
    fontSize: FontSizes.lg,
    color: Colors.gray400,
    fontWeight: FontWeights.medium,
  },
  pickerItemTextActive: {
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  separator: { fontSize: FontSizes.lg, color: Colors.gray600, fontWeight: FontWeights.medium, marginBottom: 20 },
  hintCard: { marginBottom: Spacing.xl },
  hintText: { fontSize: FontSizes.sm, color: Colors.gray700, lineHeight: 20 },
  errorText: { fontSize: FontSizes.sm, color: Colors.danger, textAlign: 'center', marginBottom: Spacing.md },
  button: { marginTop: 'auto' },
});
