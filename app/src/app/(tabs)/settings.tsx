import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, Button, Dialog } from '@/components/ui';
import { useStore } from '@/store/useStore';
import {
  pauseApi,
  userApi,
  type PauseStatusResponse,
} from '@/services/api.types';
import { PRIVACY_URL, TERMS_URL } from '@/services/config';
import { openExternalUrl } from '@/services/linking';
import { Colors, FontSizes, FontWeights, Spacing } from '@/theme';
import type { SubscriptionStatus } from '@/types';

const PLAN_LABEL: Record<string, string> = {
  free: '免费版',
  monthly: '月付',
  yearly: '年付',
};

function statusLabel(status?: SubscriptionStatus | null): string {
  switch (status) {
    case 'active':
      return '守护版';
    case 'trial':
      return '试用中';
    case 'expired':
      return '已过期';
    case 'cancelled':
      return '已取消续订';
    default:
      return '免费版';
  }
}

function formatEnd(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    user,
    reminder,
    contacts,
    subscription,
    refreshSubscription,
    resetAppState,
    setTodayStatus,
  } = useStore();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pauseStatus, setPauseStatus] = useState<PauseStatusResponse | null>(null);
  const [pauseLoading, setPauseLoading] = useState(false);

  // 进入设置时刷新订阅态（轻量 GET /subscription/status）
  useEffect(() => {
    if (user) {
      refreshSubscription();
      pauseApi.getStatus()
        .then(setPauseStatus)
        .catch(() => setPauseStatus(null));
    }
  }, [user, refreshSubscription]);

  const isPremium = !!subscription?.isPremium;
  const planLabel = PLAN_LABEL[subscription?.plan ?? 'free'] ?? '免费版';
  const endLabel = formatEnd(subscription?.currentPeriodEnd);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const openLegalUrl = async (url: string, label: string) => {
    if (!url) {
      Alert.alert(`${label}未配置`, '请先配置对应的 EXPO_PUBLIC 环境变量。');
      return;
    }
    await openExternalUrl(url);
  };

  const handlePause = async (days: number) => {
    if (pauseLoading) return;
    setPauseLoading(true);
    try {
      const res = await pauseApi.pause({ days, reason: '用户在设置页手动暂停' });
      setPauseStatus({
        isPaused: true,
        pauseEndAt: res.pauseEndAt,
        daysRemaining: res.days,
        reason: '用户在设置页手动暂停',
      });
      setTodayStatus('paused');
    } catch (e: any) {
      Alert.alert('暂停失败', e?.response?.data?.message ?? '请稍后重试');
    } finally {
      setPauseLoading(false);
    }
  };

  const handleResume = async () => {
    if (pauseLoading) return;
    setPauseLoading(true);
    try {
      const res = await pauseApi.resume();
      setPauseStatus({ isPaused: false });
      setTodayStatus(res.guardStatus as any);
    } catch (e: any) {
      Alert.alert('恢复失败', e?.response?.data?.message ?? '请稍后重试');
    } finally {
      setPauseLoading(false);
    }
  };

  const handleDeleteData = async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      await userApi.deleteAccount('确认删除');
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      resetAppState();
      setDeleteDialogVisible(false);
      router.replace('/onboarding/login');
    } catch (e: any) {
      Alert.alert('删除失败', e?.response?.data?.message ?? '请稍后重试');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>设置</Text>

        <Card title="提醒设置" style={styles.card}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>提醒时间</Text>
            <Text style={styles.settingValue}>
              {reminder.startTime} - {reminder.endTime}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>紧急联系人</Text>
            <Text style={styles.settingValue}>{contacts[0]?.name || '未设置'}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>订阅状态</Text>
            <View
              style={[
                styles.statusTag,
                {
                  backgroundColor: isPremium ? Colors.primaryLight : Colors.gray100,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusTagText,
                  { color: isPremium ? Colors.primary : Colors.gray700 },
                ]}
              >
                {statusLabel(subscription?.status)}
                {planLabel !== '免费版' ? ` · ${planLabel}` : ''}
              </Text>
            </View>
          </View>
          {endLabel && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>
                {subscription?.status === 'trial' ? '试用截止' : '有效期至'}
              </Text>
              <Text style={styles.settingValue}>{endLabel}</Text>
            </View>
          )}
        </Card>

        <Card title="临时暂停" style={styles.card}>
          {pauseStatus?.isPaused ? (
            <>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>当前状态</Text>
                <Text style={styles.settingValue}>已暂停</Text>
              </View>
              {pauseStatus.pauseEndAt && (
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>暂停至</Text>
                  <Text style={styles.settingValue}>{formatEnd(pauseStatus.pauseEndAt)}</Text>
                </View>
              )}
              <Button variant="primary" onPress={handleResume} loading={pauseLoading}>
                恢复提醒
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.pauseHint}>
                出差、住院或短期不方便回复时可暂停每日提醒，暂停期间不会触发告警。
              </Text>
              <View style={styles.pauseRow}>
                {[1, 3, 7].map((days) => (
                  <Pressable
                    key={days}
                    disabled={pauseLoading}
                    onPress={() => handlePause(days)}
                    style={[styles.pauseButton, pauseLoading && styles.pauseButtonDisabled]}
                  >
                    <Text style={styles.pauseButtonText}>暂停 {days} 天</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Legal & data */}
        <Card title="法律与数据" style={styles.card}>
          <Pressable
            style={styles.linkRow}
            onPress={() => openLegalUrl(TERMS_URL, '用户协议')}
            accessibilityLabel="查看用户协议"
          >
            <Text style={styles.linkText}>查看协议</Text>
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => openLegalUrl(PRIVACY_URL, '隐私政策')}
            accessibilityLabel="查看隐私政策"
          >
            <Text style={styles.linkText}>隐私政策</Text>
          </Pressable>
          <Pressable
            style={styles.dangerLinkRow}
            onPress={() => setDeleteDialogVisible(true)}
          >
            <Text style={styles.dangerLinkText}>删除我的数据</Text>
          </Pressable>
        </Card>

        {/* Subscription management */}
        <Card title="订阅管理" style={styles.card}>
          <View style={styles.planRow}>
            <Text style={styles.planLabel}>当前套餐</Text>
            <Text style={styles.planValue}>
              {isPremium ? `守护版 · ${planLabel}` : '免费版'}
            </Text>
          </View>

          {isPremium ? (
            <>
              {subscription?.status === 'cancelled' ? (
                <Button variant="warm" onPress={() => router.push('/subscription')}>
                  重新开通
                </Button>
              ) : (
                <Pressable
                  onPress={() =>
                    openExternalUrl(
                      'https://apps.apple.com/account/subscriptions',
                    )
                  }
                  accessibilityLabel="在 Apple 账户中管理订阅"
                >
                  <Text style={[styles.linkText, { textAlign: 'center' }]}>
                    在 Apple 账户中管理订阅 →
                  </Text>
                </Pressable>
              )}
            </>
          ) : (
            <Button
              variant="primary"
              onPress={() => router.push('/subscription')}
            >
              {subscription?.status === 'expired' ? '重新开通守护版' : '升级守护版'}
            </Button>
          )}
        </Card>

        {/* Version */}
        <Text style={styles.version}>今天还好 v{appVersion}</Text>
      </ScrollView>

      {/* Delete confirmation dialog */}
      <Dialog
        visible={deleteDialogVisible}
        title="确定删除所有数据吗？"
        message="删除后无法恢复，包括：回复记录、联系人信息、提醒设置。你的紧急联系人将不再收到通知。"
        confirmText={deleteLoading ? '删除中...' : '确认删除'}
        cancelText="取消"
        variant="danger"
        onConfirm={handleDeleteData}
        onCancel={() => {
          setDeleteDialogVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  card: {
    gap: Spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  settingLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
  },
  settingValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    color: Colors.gray900,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  linkRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  linkText: {
    fontSize: FontSizes.base,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  pauseHint: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    lineHeight: 20,
  },
  pauseRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pauseButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  pauseButtonDisabled: {
    opacity: 0.6,
  },
  pauseButtonText: {
    fontSize: FontSizes.sm,
    color: Colors.primaryDark,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
  dangerLinkRow: {
    paddingVertical: Spacing.sm,
  },
  dangerLinkText: {
    fontSize: FontSizes.base,
    color: Colors.danger,
    fontWeight: FontWeights.semibold,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  planLabel: {
    fontSize: FontSizes.base,
    color: Colors.gray700,
  },
  planValue: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  version: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
