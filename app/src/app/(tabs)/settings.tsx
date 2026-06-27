import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Button, Banner, Dialog } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
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
    notificationAuthorized,
  } = useStore();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // 进入设置时刷新订阅态（轻量 GET /subscription/status）
  useEffect(() => {
    if (user) {
      refreshSubscription();
    }
  }, [user, refreshSubscription]);

  const status = subscription?.status ?? 'none';
  const isPremium = !!subscription?.isPremium;
  const planLabel = PLAN_LABEL[subscription?.plan ?? 'free'] ?? '免费版';
  const endLabel = formatEnd(subscription?.currentPeriodEnd);

  const handleDeleteData = () => {
    if (deleteConfirmText === '确认删除') {
      // TODO: Call API to delete user data
      console.log('Deleting user data...');
      setDeleteDialogVisible(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="设置" showMascot={false} onBack={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Guard settings */}
        <Card title="守护设置" style={styles.card}>
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

        {/* Family settings */}
        <Card title="家庭设置" style={styles.card}>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/subscription/proxy')}
            accessibilityLabel="为家人开通守护"
          >
            <Text style={styles.linkText}>为家人开通守护 →</Text>
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/subscription')}
            accessibilityLabel="升级守护版"
          >
            <Text style={styles.linkText}>升级守护版 →</Text>
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/guardian')}
            accessibilityLabel="守护中心"
          >
            <Text style={styles.linkText}>守护中心 →</Text>
          </Pressable>
        </Card>

        {/* Pause guard */}
        <Card style={styles.card}>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={styles.pauseText}>⏸️ 暂停守护</Text>
          </Pressable>
        </Card>

        {/* Legal & data */}
        <Card title="法律与数据" style={styles.card}>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkText}>查看协议</Text>
          </Pressable>
          <Pressable style={styles.linkRow}>
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
                    Linking.openURL(
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
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/guardian')}
            accessibilityLabel="守护中心"
          >
            <Text style={[styles.linkText, { textAlign: 'center' }]}>守护中心 →</Text>
          </Pressable>
        </Card>

        {/* Version */}
        <Text style={styles.version}>今天还好 v1.0</Text>
      </ScrollView>

      {/* Delete confirmation dialog */}
      <Dialog
        visible={deleteDialogVisible}
        title="确定删除所有数据吗？"
        message="删除后无法恢复，包括：回复记录、联系人信息、守护设置。你的紧急联系人将不再收到通知。"
        confirmText="确认删除"
        cancelText="取消"
        variant="danger"
        onConfirm={handleDeleteData}
        onCancel={() => {
          setDeleteDialogVisible(false);
          setDeleteConfirmText('');
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
  freeTag: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeTagText: {
    fontSize: FontSizes.sm,
    color: Colors.gray700,
    fontWeight: FontWeights.medium,
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
  dangerLinkRow: {
    paddingVertical: Spacing.sm,
  },
  dangerLinkText: {
    fontSize: FontSizes.base,
    color: Colors.danger,
    fontWeight: FontWeights.semibold,
  },
  pauseText: {
    fontSize: FontSizes.base,
    color: Colors.warmDark,
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
