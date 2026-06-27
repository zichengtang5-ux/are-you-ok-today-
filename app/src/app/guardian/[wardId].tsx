import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Card, Button, LoadingState, Banner } from '@/components/ui';
import {
  guardianApi,
  type WardDashboardResponse,
} from '@/services/api.types';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius, Shadows } from '@/theme';

const STATUS_CONFIG: Record<string, { emoji: string; title: string; hint: string; color: string; bg: string }> = {
  replied: {
    emoji: 'OK',
    title: '今天已报平安',
    hint: 'TA 今天已经回复过了',
    color: Colors.primaryDark,
    bg: Colors.primaryLight,
  },
  waiting: {
    emoji: '月',
    title: '等待 TA 回复',
    hint: '提醒时间段内，TA 还未回复',
    color: Colors.warmDark,
    bg: Colors.warmLight,
  },
  grace: {
    emoji: '...',
    title: '宽限期',
    hint: 'TA 还没回复，即将通知你',
    color: Colors.warmDark,
    bg: Colors.warmLight,
  },
  alert: {
    emoji: '!!',
    title: '告警中',
    hint: 'TA 长时间未回复，请注意确认',
    color: Colors.dangerDark,
    bg: Colors.dangerLight,
  },
  idle: {
    emoji: '日',
    title: '非提醒时段',
    hint: '今天还未进入提醒时间',
    color: Colors.gray700,
    bg: Colors.gray100,
  },
  paused: {
    emoji: '||',
    title: '守护已暂停',
    hint: 'TA 主动暂停了守护',
    color: Colors.gray700,
    bg: Colors.gray100,
  },
};

function formatDay(date: string): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatWeekday(date: string): string {
  const d = new Date(date);
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
}

function formatLastReply(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 1) {
    return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

export default function WardDashboardScreen() {
  const router = useRouter();
  const { wardId } = useLocalSearchParams<{ wardId: string }>();
  const user = useStore((s) => s.user);
  const [data, setData] = useState<WardDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proxyLoading, setProxyLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!wardId) return;
      let cancelled = false;
      setLoading(true);
      setError('');
      guardianApi
        .getDashboard(wardId)
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch((e: any) => {
          if (!cancelled) setError(e?.response?.data?.message ?? '加载看板失败');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [wardId, refreshKey]),
  );

  const handleProxy = async () => {
    if (!wardId) return;
    Alert.alert(
      '代确认平安',
      `你确定要代 ${data?.wardName ?? 'TA'} 确认"今天没事"吗？这会记录为你代确认。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            setProxyLoading(true);
            try {
              await guardianApi.proxyReply(wardId);
              setRefreshKey((k) => k + 1);
            } catch (e: any) {
              Alert.alert('操作失败', e?.response?.data?.message ?? '请稍后重试');
            } finally {
              setProxyLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
        </View>
        <LoadingState message="加载关怀看板..." />
      </SafeAreaView>
    );
  }

  if (!data || error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
        </View>
        <View style={styles.errorWrap}>
          <Banner variant="danger">{error || '数据为空'}</Banner>
          <Button variant="outline" onPress={() => setRefreshKey((k) => k + 1)}>
            重试
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.idle;
  const isPremium = user?.isPremium === true;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <View style={styles.wardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{data.wardName[0]}</Text>
          </View>
          <View>
            <Text style={styles.wardName}>{data.wardName}</Text>
            <Text style={styles.wardSub}>
              {data.lastReplyAt ? `最后回复 ${formatLastReply(data.lastReplyAt)}` : '暂无回复记录'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Status card */}
        <View style={[styles.statusCard, { backgroundColor: statusCfg.bg }]}>
          <Text style={styles.statusEmoji}>{statusCfg.emoji}</Text>
          <Text style={[styles.statusTitle, { color: statusCfg.color }]}>
            {statusCfg.title}
          </Text>
          <Text style={[styles.statusHint, { color: statusCfg.color }]}>
            {statusCfg.hint}
          </Text>
        </View>

        {/* Proxy button (for waiting/grace/alert) */}
        {(data.status === 'waiting' || data.status === 'grace' || data.status === 'alert') && (
          <Button
            variant={data.status === 'alert' ? 'danger' : 'primary'}
            onPress={handleProxy}
            loading={proxyLoading}
          >
            代确认"TA 没事"
          </Button>
        )}

        {/* Monthly stats */}
        {isPremium && data.monthlyStats ? (
          <Card title="本月平安天数" style={styles.statsCard}>
            <View style={styles.statsMainRow}>
              <Text style={styles.statsBig}>{data.monthlyStats.repliedDays}</Text>
              <Text style={styles.statsSlash}>/</Text>
              <Text style={styles.statsTotal}>{data.monthlyStats.totalDays}</Text>
              <Text style={styles.statsUnit}> 天</Text>
            </View>
            <Text style={styles.statsDisplay}>{data.monthlyStats.display}</Text>
          </Card>
        ) : (
          <Card variant="warm" style={styles.upsellCard}>
            <Text style={styles.upsellEmoji}>锁</Text>
            <Text style={styles.upsellTitle}>升级解锁完整关怀看板</Text>
            <Text style={styles.upsellDesc}>
              查看 TA 的 30 天回复日历、本月平安天数、代确认历史记录
            </Text>
            <Button variant="warm" size="sm" onPress={() => {}}>
              升级守护版 →
            </Button>
          </Card>
        )}

        {/* 7-day grid */}
        {isPremium && data.recentDays && data.recentDays.length > 0 && (
          <Card title="最近 7 天" style={styles.gridCard}>
            <View style={styles.gridRow}>
              {data.recentDays.slice(0, 7).map((day) => (
                <View key={day.date} style={styles.gridDay}>
                  <Text style={styles.gridWeekday}>{formatWeekday(day.date)}</Text>
                  <View
                    style={[
                      styles.gridCell,
                      day.replied ? styles.gridCellOk : styles.gridCellMiss,
                    ]}
                  >
                    <Text
                      style={[
                        styles.gridEmoji,
                        day.replied
                          ? { color: Colors.primary }
                          : { color: Colors.danger },
                      ]}
                    >
                      {day.replied ? '✓' : '✕'}
                    </Text>
                  </View>
                  <Text style={styles.gridDate}>{formatDay(day.date)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* History */}
        {isPremium && data.history && data.history.length > 0 && (
          <Card title="历史动态" style={styles.historyCard}>
            {data.history.map((h, idx) => (
              <View key={`${h.date}-${idx}`} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyEvent}>{h.event}</Text>
                  <Text style={styles.historyDate}>{h.date}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Quick actions */}
        <Card title="快速操作" style={styles.quickCard}>
          <Pressable
            onPress={() => router.push('/help/emergency')}
            style={styles.quickRow}
          >
            <Text style={styles.quickIcon}>🆘</Text>
            <Text style={styles.quickLabel}>发起紧急求助</Text>
            <Text style={styles.quickArrow}>→</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/guardian')}
            style={styles.quickRow}
          >
            <Text style={styles.quickIcon}>人</Text>
            <Text style={styles.quickLabel}>返回守护中心</Text>
            <Text style={styles.quickArrow}>→</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    marginBottom: Spacing.sm,
  },
  backText: {
    fontSize: FontSizes.base,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  wardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  wardName: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  wardSub: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  errorWrap: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  statusCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statusEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  statusTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  statusHint: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  statsCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statsMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  statsBig: {
    fontSize: FontSizes['4xl'],
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  statsSlash: {
    fontSize: FontSizes['2xl'],
    color: Colors.gray400,
    marginHorizontal: 4,
  },
  statsTotal: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.semibold,
    color: Colors.gray600,
  },
  statsUnit: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
  },
  statsDisplay: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
  },
  upsellCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  upsellEmoji: {
    fontSize: 40,
  },
  upsellTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  upsellDesc: {
    fontSize: FontSizes.sm,
    color: Colors.warmDark,
    textAlign: 'center',
    lineHeight: FontSizes.sm * 1.5,
  },
  gridCard: {
    gap: Spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridDay: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  gridWeekday: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    fontWeight: FontWeights.medium,
  },
  gridCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellOk: {
    backgroundColor: Colors.primaryLight,
  },
  gridCellMiss: {
    backgroundColor: Colors.dangerLight,
  },
  gridEmoji: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  gridDate: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
  },
  historyCard: {
    gap: Spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 8,
  },
  historyEvent: {
    fontSize: FontSizes.sm,
    color: Colors.gray800,
    lineHeight: FontSizes.sm * 1.5,
  },
  historyDate: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  quickCard: {
    gap: Spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  quickIcon: {
    fontSize: 22,
  },
  quickLabel: {
    flex: 1,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    color: Colors.gray800,
  },
  quickArrow: {
    fontSize: FontSizes.lg,
    color: Colors.gray400,
  },
});
