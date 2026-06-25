import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card, Button, EmptyState, LoadingState } from '@/components/ui';
import { guardianApi, type GuardianWardResponse } from '@/services/api.types';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius, Shadows } from '@/theme';

const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  replied: { label: '今日已报平安', dot: Colors.primary, bg: Colors.primaryLight, text: Colors.primaryDark },
  waiting: { label: '等待回复中', dot: Colors.warm, bg: Colors.warmLight, text: Colors.warmDark },
  grace: { label: '宽限期', dot: Colors.warm, bg: Colors.warmLight, text: Colors.warmDark },
  alert: { label: '告警中', dot: Colors.danger, bg: Colors.dangerLight, text: Colors.dangerDark },
  idle: { label: '非提醒时段', dot: Colors.gray400, bg: Colors.gray100, text: Colors.gray600 },
  paused: { label: '已暂停', dot: Colors.gray400, bg: Colors.gray100, text: Colors.gray600 },
};

function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function GuardianHubScreen() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const [wards, setWards] = useState<GuardianWardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      guardianApi
        .listWards()
        .then((data) => {
          if (!cancelled) setWards(data);
        })
        .catch((e: any) => {
          if (!cancelled) setError(e?.response?.data?.message ?? '加载守护列表失败');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const repliedCount = wards.filter((w) => w.status === 'replied').length;
  const alertCount = wards.filter((w) => w.status === 'alert').length;

  if (loading && wards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>守护中心</Text>
        </View>
        <LoadingState message="加载守护列表..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>守护中心</Text>
        <Text style={styles.subtitle}>关心的人，都在这里</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{wards.length}</Text>
              <Text style={styles.summaryLabel}>守护中</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: Colors.primary }]}>{repliedCount}</Text>
              <Text style={styles.summaryLabel}>今日已报平安</Text>
            </View>
            {alertCount > 0 && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: Colors.danger }]}>
                    {alertCount}
                  </Text>
                  <Text style={styles.summaryLabel}>告警中</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push('/guardian/create')}
            style={styles.actionBtn}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primaryLight }]}>
              <Text style={styles.actionEmoji}>＋</Text>
            </View>
            <Text style={styles.actionLabel}>添加守护</Text>
            <Text style={styles.actionHint}>为家人开通</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/guardian/invite')}
            style={styles.actionBtn}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.warmLight }]}>
              <Text style={styles.actionEmoji}>✉️</Text>
            </View>
            <Text style={styles.actionLabel}>接受邀请</Text>
            <Text style={styles.actionHint}>输入邀请码</Text>
          </Pressable>
        </View>

        {/* Wards list */}
        <Text style={styles.sectionTitle}>我守护的人</Text>

        {error ? (
          <Card variant="danger">
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : wards.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState message="还没有守护的人，点击上方添加" />
          </Card>
        ) : (
          <View style={styles.wardsList}>
            {wards.map((w) => {
              const statusInfo = STATUS_MAP[w.status] ?? STATUS_MAP.idle;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => router.push(`/guardian/${w.id}`)}
                  style={styles.wardCard}
                >
                  <View style={styles.wardAvatar}>
                    <Text style={styles.wardAvatarText}>{w.wardName[0]}</Text>
                  </View>
                  <View style={styles.wardInfo}>
                    <View style={styles.wardNameRow}>
                      <Text style={styles.wardName}>{w.wardName}</Text>
                      <Text style={styles.wardRelation}>{w.relation}</Text>
                    </View>
                    {!w.isBound ? (
                      <Text style={styles.unboundText}>待绑定 · 已发送邀请</Text>
                    ) : (
                      <View style={styles.wardStatusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusInfo.dot },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: statusInfo.text }]}>
                          {statusInfo.label}
                        </Text>
                        {w.lastReplyAt && (
                          <Text style={styles.wardTime}>· {formatTime(w.lastReplyAt)}</Text>
                        )}
                      </View>
                    )}
                  </View>
                  <Text style={styles.wardArrow}>›</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Emergency SOS */}
        <Pressable
          onPress={() => router.push('/help/emergency')}
          style={styles.sosCard}
        >
          <View style={styles.sosIconWrap}>
            <Text style={styles.sosIcon}>🆘</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>紧急求助</Text>
            <Text style={styles.sosHint}>一键通知所有紧急联系人</Text>
          </View>
          <Text style={styles.sosArrow}>→</Text>
        </Pressable>

        {/* Premium upsell */}
        {!user?.isPremium && (
          <Card variant="warm" style={styles.upsellCard}>
            <Text style={styles.upsellTitle}>升级守护版</Text>
            <Text style={styles.upsellDesc}>
              解锁关怀看板、查看家人 30 天回复日历、代确认等高级功能
            </Text>
            <Button variant="warm" onPress={() => {}}>
              了解升级 →
            </Button>
          </Card>
        )}
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
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.bold,
    color: Colors.white,
  },
  summaryLabel: {
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
    marginTop: Spacing.xs,
    fontWeight: FontWeights.medium,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.primarySoft,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionEmoji: {
    fontSize: 22,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  actionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  actionHint: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  emptyCard: {
    minHeight: 180,
  },
  errorText: {
    color: Colors.dangerDark,
    fontSize: FontSizes.sm,
  },
  wardsList: {
    gap: Spacing.sm,
  },
  wardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  wardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardAvatarText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  wardInfo: {
    flex: 1,
  },
  wardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  wardName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  wardRelation: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    overflow: 'hidden',
  },
  wardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  wardTime: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
  },
  unboundText: {
    fontSize: FontSizes.xs,
    color: Colors.warmDark,
    fontWeight: FontWeights.medium,
  },
  wardArrow: {
    fontSize: 24,
    color: Colors.gray400,
    fontWeight: FontWeights.regular,
  },
  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  sosIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosIcon: {
    fontSize: 22,
  },
  sosTitle: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.dangerDark,
  },
  sosHint: {
    fontSize: FontSizes.xs,
    color: Colors.dangerDark,
    marginTop: 2,
  },
  sosArrow: {
    fontSize: FontSizes.lg,
    color: Colors.dangerDark,
    fontWeight: FontWeights.semibold,
  },
  upsellCard: {
    gap: Spacing.sm,
  },
  upsellTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.warmDark,
  },
  upsellDesc: {
    fontSize: FontSizes.sm,
    color: Colors.warmDark,
    lineHeight: FontSizes.sm * 1.5,
    marginBottom: Spacing.sm,
  },
});
