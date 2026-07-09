import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { reminderApi } from '@/services/api.types';
import { scheduleDailyReminder } from '@/services/notifications';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

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

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(options.length - 1, idx));
    if (options[clamped] !== value) {
      onChange(options[clamped]);
    }
  };

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
          onScroll={handleScroll}
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

function parseTime(time: string): string {
  const hour = Number(time.split(':')[0]);
  if (!Number.isFinite(hour)) return '20:00';
  return `${String(Math.max(0, Math.min(23, hour))).padStart(2, '0')}:00`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function EditReminderScreen() {
  const router = useRouter();
  const { reminder, user, setReminder } = useStore();

  const [startTime, setStartTime] = useState(() => parseTime(reminder.startTime));
  const [endTime, setEndTime] = useState(() => parseTime(reminder.endTime));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      setError('结束时间必须晚于开始时间');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await reminderApi.updateConfig({ startTime, endTime });
      setReminder({ ...reminder, startTime, endTime });
      await scheduleDailyReminder(startTime, endTime, user?.nickname);
      router.back();
    } catch (err: any) {
      setError(err.response?.data?.message || '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="编辑提醒时间" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>提醒时间窗口</Text>
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button variant="primary" size="lg" onPress={handleSave} loading={loading} style={styles.button}>
          保存
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg, gap: Spacing.lg },
  card: { alignItems: 'center' },
  cardTitle: { fontSize: FontSizes.base, color: Colors.gray700, fontWeight: FontWeights.medium, marginBottom: Spacing.lg },
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
  hintCard: {},
  hintText: { fontSize: FontSizes.sm, color: Colors.gray700, lineHeight: 20 },
  errorText: { fontSize: FontSizes.sm, color: Colors.danger, textAlign: 'center' },
  button: { marginTop: Spacing.md },
});
