import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { pauseApi } from '@/services/api.types';
import { isOfflineDevSession } from '@/services/devMock';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

const DAYS = Array.from({ length: 14 }, (_, index) => index + 1);
const ITEM_HEIGHT = 46;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function DayPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: (value - 1) * ITEM_HEIGHT, animated: false });
  }, [value]);

  const selectAtOffset = (event: any) => {
    const index = Math.max(0, Math.min(DAYS.length - 1, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    onChange(DAYS[index]);
  };

  return (
    <View style={styles.pickerWrap}>
      <View pointerEvents="none" style={styles.pickerHighlight} />
      <ScrollView
        ref={scrollRef}
        style={styles.picker}
        contentContainerStyle={styles.pickerContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={selectAtOffset}
      >
        <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
        {DAYS.map((days) => (
          <View key={days} style={styles.pickerItem}>
            <Text style={[styles.pickerItemText, days === value && styles.pickerItemTextActive]}>{days} 天</Text>
          </View>
        ))}
        <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
      </ScrollView>
    </View>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export default function PauseSettingsScreen() {
  const router = useRouter();
  const setTodayStatus = useStore((state) => state.setTodayStatus);
  const [selected, setSelected] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [pauseEndAt, setPauseEndAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewBaseTime] = useState(() => Date.now());

  useEffect(() => {
    pauseApi.getStatus().then((status) => {
      setIsPaused(status.isPaused);
      setDaysRemaining(status.daysRemaining ?? null);
      setPauseEndAt(status.pauseEndAt ?? null);
    }).catch(() => {});
  }, []);

  const handlePause = async () => {
    setSubmitting(true);
    try {
      const result = await pauseApi.pause({ days: selected });
      setTodayStatus('paused');
      Alert.alert('守护已暂停', `将在 ${formatDate(result.pauseEndAt)} 自动恢复`);
      router.back();
    } catch (error: any) {
      if (await isOfflineDevSession()) {
        setTodayStatus('paused');
        Alert.alert('守护已暂停', `${selected} 天后将自动恢复`);
        router.back();
        return;
      }
      Alert.alert('暂停失败', error.response?.data?.message || '请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async () => {
    setSubmitting(true);
    try {
      await pauseApi.resume();
      setTodayStatus('idle');
      Alert.alert('守护已恢复', '今晚将正常收到提醒');
      router.back();
    } catch (error: any) {
      if (await isOfflineDevSession()) {
        setTodayStatus('idle');
        Alert.alert('守护已恢复', '今晚将正常收到提醒');
        router.back();
        return;
      }
      Alert.alert('恢复失败', error.response?.data?.message || '请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="暂停守护" showMascot={false} onBack={() => router.back()} />
      <View style={styles.content}>
        {isPaused && pauseEndAt ? (
          <Card variant="warm" style={styles.pausedCard}>
            <Text style={styles.pausedTitle}>守护已暂停</Text>
            <Text style={styles.pausedHint}>将在 {formatDate(pauseEndAt)} 自动恢复{daysRemaining != null ? `，还剩 ${daysRemaining} 天` : ''}</Text>
            <Button variant="primary" size="lg" onPress={handleResume} loading={submitting} style={styles.actionButton}>立即恢复守护</Button>
          </Card>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>暂时关闭自动守护</Text>
              <Text style={styles.subtitle}>暂停期间不会提醒你，也不会通知联系人</Text>
            </View>
            <Card style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>暂停时长</Text>
              <DayPicker value={selected} onChange={setSelected} />
              <Text style={styles.recoveryHint}>将在 {formatDate(new Date(previewBaseTime + selected * 24 * 60 * 60 * 1000).toISOString())} 自动恢复</Text>
            </Card>
            <Card variant="info" style={styles.infoCard}>
              <Text style={styles.infoTitle}>暂停期间</Text>
              <Text style={styles.infoLine}>不发送每日提醒，不触发联系人告警</Text>
              <Text style={styles.infoLine}>可随时提前恢复，最长暂停 14 天</Text>
            </Card>
            <Button variant="primary" size="lg" onPress={handlePause} loading={submitting} style={styles.actionButton}>{`暂停守护 ${selected} 天`}</Button>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  content: { flex: 1, padding: Spacing.lg, gap: Spacing.lg },
  header: { gap: 6 },
  title: { fontSize: FontSizes['2xl'], fontWeight: FontWeights.bold, color: Colors.gray900 },
  subtitle: { fontSize: FontSizes.base, color: Colors.gray600, lineHeight: 22 },
  pickerCard: { alignItems: 'center', paddingVertical: Spacing.lg },
  pickerTitle: { fontSize: FontSizes.base, fontWeight: FontWeights.semibold, color: Colors.gray700, marginBottom: Spacing.sm },
  pickerWrap: { height: PICKER_HEIGHT, width: 190, overflow: 'hidden', position: 'relative' },
  picker: { flex: 1 },
  pickerContent: { paddingHorizontal: 8 },
  pickerHighlight: { position: 'absolute', top: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2, height: ITEM_HEIGHT, width: '100%', backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, zIndex: 1 },
  pickerItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  pickerItemText: { fontSize: FontSizes.base, color: Colors.gray400 },
  pickerItemTextActive: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.primaryDark },
  recoveryHint: { fontSize: FontSizes.sm, color: Colors.primaryDark, marginTop: Spacing.sm },
  infoCard: { gap: 6 },
  infoTitle: { fontSize: FontSizes.base, fontWeight: FontWeights.semibold, color: Colors.gray900 },
  infoLine: { fontSize: FontSizes.sm, color: Colors.gray600, lineHeight: 21 },
  pausedCard: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  pausedTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.warmDark },
  pausedHint: { fontSize: FontSizes.base, color: Colors.warmDark, textAlign: 'center', lineHeight: 22 },
  actionButton: { marginTop: 'auto' },
});
