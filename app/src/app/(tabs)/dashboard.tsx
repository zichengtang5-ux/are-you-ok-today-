import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, Button } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { guardianApi, type GuardianWardResponse, type WardDashboardResponse } from '@/services/api.types';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDayNumber(dateStr: string): number {
  try {
    return new Date(dateStr).getDate();
  } catch {
    return 0;
  }
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const { guardians, subscription } = useStore();
  const isPremium = !!subscription?.isPremium;

  const [dashboard, setDashboard] = useState<WardDashboardResponse | null>(null);
  const [proxySubmitting, setProxySubmitting] = useState(false);

  const ward = (guardians.find((g) => g.isBound) ?? guardians[0] ?? null) as GuardianWardResponse | null;

  const fetchDashboard = useCallback(() => {
    if (!ward) return;
    guardianApi.getDashboard(ward.id)
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, [ward?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!ward) return;
      fetchDashboard();
      const timer = setInterval(fetchDashboard, 30000);
      return () => clearInterval(timer);
    }, [ward?.id, fetchDashboard]),
  );

  const handleProxyReply = async () => {
    if (!ward || proxySubmitting) return;
    setProxySubmitting(true);
    try {
      const result = await guardianApi.proxyReply(ward.id);
      Alert.alert('已代确认', result.message || '已代确认"TA没事"');
      fetchDashboard();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        Alert.alert('无法代确认', '守护关系尚未绑定，无法代确认');
      } else {
        Alert.alert('代确认失败', err?.response?.data?.message ?? err?.message ?? '请稍后再试');
      }
    } finally {
      setProxySubmitting(false);
    }
  };

  if (!ward) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <GreenStatusBar variant="white" title="关怀看板" showMascot={false} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>还没有守护的家人</Text>
          <Text style={styles.emptyText}>为家人开通守护，随时查看平安状态</Text>
          <Button
            variant="primary"
            size="md"
            onPress={() => router.push('/guardian/create')}
            style={styles.emptyCta}
          >
            添加守护家人
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const activeWard = ward;
  const wardName = dashboard?.wardName ?? activeWard.wardName;
  const wardStatus = dashboard?.status ?? activeWard.status;
  const isOk = wardStatus === 'replied';
  const recentDays = dashboard?.recentDays ?? null;
  const monthlyStats = dashboard?.monthlyStats ?? null;
  const history = dashboard?.history ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="关怀看板" showMascot={false} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>关怀看板</Text>
          <View style={styles.profile}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{wardName?.[0] ?? '?'}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{wardName}的守护</Text>
              <Text style={styles.detail}>
                提醒时间 {activeWard.reminderConfig?.startTime ?? '—'} - {activeWard.reminderConfig?.endTime ?? '—'}
              </Text>
            </View>
            <View style={[styles.statusTag, isOk ? styles.statusOk : styles.statusAlert]} accessibilityRole="text" accessibilityLabel={`守护状态：${isOk ? '正常' : '未确认'}`}>
              <Text style={styles.statusText}>{isOk ? '正常' : '未确认'}</Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <Card title="平安日历">
          {isPremium && recentDays && recentDays.length > 0 ? (
            <>
              <Text style={styles.calendarLabel}>最近 {recentDays.length} 天</Text>
              <View style={styles.calendarGrid}>
                {recentDays.slice(0, 7).map((day, idx) => (
                  <View key={day.date} style={{ width: '14.28%' }}>
                    <Text style={styles.weekday}>{WEEKDAYS[idx % 7]}</Text>
                  </View>
                ))}
                {recentDays.slice(0, 7).map((day) => {
                  const isToday = day.date === todayStr;
                  return (
                    <View
                      key={day.date}
                      style={[
                        styles.dayCell,
                        day.replied ? styles.dayOk : styles.dayMiss,
                        isToday && styles.dayToday,
                      ]}
                    >
                      <Text style={styles.dayNumber}>{formatDayNumber(day.date)}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendOk]} />
                  <Text style={styles.legendText}>已回复</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendMiss]} />
                  <Text style={styles.legendText}>未回复</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                {isPremium ? '暂无回复记录' : '升级守护版查看完整平安日历'}
              </Text>
            </View>
          )}
        </Card>

        {/* Stats */}
        <Card title="统计数据" style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>最后回复</Text>
            <Text style={styles.statValue}>{formatTime(dashboard?.lastReplyAt ?? activeWard.lastReplyAt)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>本月平安</Text>
            <Text style={styles.statValue}>
              {isPremium && monthlyStats
                ? `${monthlyStats.repliedDays}/${monthlyStats.totalDays} 天`
                : '—'}
            </Text>
          </View>
          {isPremium && history && history.length > 0 && history.slice(0, 3).map((h) => (
            <View key={h.date} style={styles.statRow}>
              <Text style={styles.statLabel}>{formatDate(h.date)}</Text>
              <View style={styles.eventTag}>
                <Text style={styles.eventText} numberOfLines={1}>{h.event}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Proxy confirm */}
        {!isOk && (
          <Button
            variant="primary"
            onPress={handleProxyReply}
            disabled={proxySubmitting}
            accessibilityRole="button"
            accessibilityLabel="代确认 TA 没事"
          >
            {proxySubmitting ? '代确认中...' : '代确认"TA没事"'}
          </Button>
        )}

        {/* Upgrade hint */}
        {!isPremium && (
          <Card variant="warm" style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>升级守护版</Text>
            <Text style={styles.upgradeText}>
              查看完整平安日历，获取更详细的关怀数据和历史事件
            </Text>
            <Button variant="warm" size="sm" onPress={() => router.push('/subscription')}>
              升级守护版
            </Button>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyCta: { marginTop: Spacing.sm },
  header: { marginBottom: Spacing.md },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  profileInfo: { flex: 1 },
  name: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  detail: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOk: { backgroundColor: Colors.primaryLight },
  statusAlert: { backgroundColor: Colors.warmLight },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    color: Colors.primaryDark,
  },
  calendarLabel: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginBottom: Spacing.md,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  weekday: {
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    marginBottom: Spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  dayOk: { backgroundColor: Colors.primaryLight },
  dayMiss: { backgroundColor: Colors.dangerLight },
  dayToday: { borderWidth: 2, borderColor: Colors.primary },
  dayNumber: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.gray800,
  },
  legend: { flexDirection: 'row', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendOk: { backgroundColor: Colors.primaryLight },
  legendMiss: { backgroundColor: Colors.dangerLight },
  legendText: { fontSize: FontSizes.xs, color: Colors.gray600 },
  placeholder: { paddingVertical: Spacing.md, alignItems: 'center' },
  placeholderText: { fontSize: FontSizes.sm, color: Colors.gray500, textAlign: 'center' },
  statsCard: { gap: Spacing.sm },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  statLabel: { fontSize: FontSizes.base, color: Colors.gray600, flexShrink: 0 },
  statValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
    flexShrink: 1,
    textAlign: 'right',
  },
  eventTag: {
    backgroundColor: Colors.warmLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '60%',
  },
  eventText: { fontSize: FontSizes.sm, color: Colors.warmDark },
  upgradeCard: { alignItems: 'center', gap: Spacing.sm },
  upgradeTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  upgradeText: {
    fontSize: FontSizes.base,
    color: Colors.warmDark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
