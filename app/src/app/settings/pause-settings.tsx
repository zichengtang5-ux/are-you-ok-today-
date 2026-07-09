import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Button } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { pauseApi } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

const PRESETS = [
  { days: 1, label: '1 天', hint: '明天恢复' },
  { days: 3, label: '3 天', hint: '短期出行' },
  { days: 7, label: '7 天', hint: '一周出差' },
  { days: 14, label: '14 天', hint: '长假' },
];

export default function PauseSettingsScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<number>(3);
  const [isPaused, setIsPaused] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [pauseEndAt, setPauseEndAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    pauseApi.getStatus().then((s) => {
      setIsPaused(s.isPaused);
      setDaysRemaining(s.daysRemaining ?? null);
      setPauseEndAt(s.pauseEndAt ?? null);
    }).catch(() => {});
  }, []);

  const handlePause = async () => {
    setSubmitting(true);
    try {
      const result = await pauseApi.pause({ days: selected });
      Alert.alert('守护已暂停', `将在 ${new Date(result.pauseEndAt).toLocaleDateString('zh-CN')} 自动恢复`);
      router.back();
    } catch (err: any) {
      Alert.alert('暂停失败', err?.message || '请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async () => {
    setSubmitting(true);
    try {
      await pauseApi.resume();
      Alert.alert('守护已恢复', '今晚将正常收到提醒');
      router.back();
    } catch (err: any) {
      Alert.alert('恢复失败', err?.message || '请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="暂停守护" showMascot={false} onBack={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {isPaused && pauseEndAt ? (
          <Card variant="warm" style={styles.pausedCard}>
            <Text style={styles.pausedTitle}>守护已暂停</Text>
            <Text style={styles.pausedHint}>
              将在 {new Date(pauseEndAt).toLocaleDateString('zh-CN')} 自动恢复
              {daysRemaining != null ? `（还剩 ${daysRemaining} 天）` : ''}
            </Text>
            <Button
              variant="primary"
              size="lg"
              onPress={handleResume}
              disabled={submitting}
              style={styles.resumeBtn}
            >
              {submitting ? '恢复中...' : '立即恢复守护'}
            </Button>
          </Card>
        ) : (
          <>
            <Text style={styles.sectionTitle}>暂停时长</Text>
            <View style={styles.presetGrid}>
              {PRESETS.map((p) => {
                const active = selected === p.days;
                return (
                  <Pressable
                    key={p.days}
                    onPress={() => setSelected(p.days)}
                    style={[styles.presetCard, active && styles.presetCardActive]}
                  >
                    <Text style={[styles.presetLabel, active && styles.presetLabelActive]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.presetHint, active && styles.presetHintActive]}>
                      {p.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Card style={styles.infoCard}>
              <Text style={styles.infoTitle}>暂停期间</Text>
              <Text style={styles.infoLine}>• 不会收到每日提醒</Text>
              <Text style={styles.infoLine}>• 不会触发告警通知联系人</Text>
              <Text style={styles.infoLine}>• 可随时提前恢复</Text>
            </Card>

            <Button
              variant="primary"
              size="lg"
              onPress={handlePause}
              disabled={submitting}
              style={styles.submitBtn}
            >
              {submitting ? '暂停中...' : `暂停守护 ${selected} 天`}
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },
  pausedCard: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  pausedTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  pausedHint: {
    fontSize: FontSizes.base,
    color: Colors.warmDark,
    textAlign: 'center',
  },
  resumeBtn: { marginTop: Spacing.sm },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  presetCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.gray200,
    alignItems: 'center',
    gap: 4,
  },
  presetCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  presetLabel: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  presetLabelActive: { color: Colors.primaryDark },
  presetHint: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
  },
  presetHintActive: { color: Colors.primary },
  infoCard: { gap: 4 },
  infoTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
    marginBottom: 4,
  },
  infoLine: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    lineHeight: 22,
  },
  submitBtn: { marginTop: Spacing.sm },
});
