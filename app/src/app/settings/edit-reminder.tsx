import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { reminderApi } from '@/services/api.types';
import { scheduleDailyReminder } from '@/services/notifications';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function timeToIndex(time: string, list: string[]): number {
  const idx = list.indexOf(time);
  return idx >= 0 ? idx : 0;
}

function TimeScroll({ value, options, onChange, label }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string;
}) {
  return (
    <View style={styles.timePicker}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeOptions}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.timeOption, value === opt && styles.timeOptionActive]}
          >
            <Text style={[styles.timeOptionText, value === opt && styles.timeOptionTextActive]}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function EditReminderScreen() {
  const router = useRouter();
  const { reminder, setReminder } = useStore();

  const [startTime, setStartTime] = useState(reminder.startTime);
  const [endTime, setEndTime] = useState(reminder.endTime);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (startTime >= endTime) {
      setError('结束时间必须晚于开始时间');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await reminderApi.updateConfig({ startTime, endTime });
      setReminder({ ...reminder, startTime, endTime });
      await scheduleDailyReminder(startTime, endTime);
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>提醒时间窗口</Text>
          <View style={styles.pickersRow}>
            <TimeScroll value={startTime} options={HOURS} onChange={setStartTime} label="开始（时）" />
            <Text style={styles.separator}>至</Text>
            <TimeScroll value={endTime} options={HOURS} onChange={setEndTime} label="结束（时）" />
          </View>
        </Card>

        <Card variant="info" style={styles.hintCard}>
          <Text style={styles.hintText}>
            如果 {endTime}:00 前没回复，系统会先温和提醒你，再给 30 分钟宽限期，之后才通知联系人。
          </Text>
        </Card>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button variant="primary" size="lg" onPress={handleSave} loading={loading} style={styles.button}>
          保存
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },
  card: { alignItems: 'center' },
  cardTitle: { fontSize: FontSizes.base, color: Colors.gray700, fontWeight: FontWeights.medium, marginBottom: Spacing.md },
  pickersRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  timePicker: { alignItems: 'center' },
  timeLabel: { fontSize: FontSizes.sm, color: Colors.gray600, marginBottom: 8 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 180 },
  timeOption: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.sm, backgroundColor: Colors.gray100,
  },
  timeOptionActive: { backgroundColor: Colors.primary },
  timeOptionText: { fontSize: FontSizes.sm, color: Colors.gray700 },
  timeOptionTextActive: { color: Colors.white, fontWeight: FontWeights.bold },
  separator: { fontSize: FontSizes.lg, color: Colors.gray600, fontWeight: FontWeights.medium },
  hintCard: {},
  hintText: { fontSize: FontSizes.sm, color: Colors.gray700, lineHeight: 20 },
  errorText: { fontSize: FontSizes.sm, color: Colors.danger, textAlign: 'center' },
  button: { marginTop: Spacing.md },
});
