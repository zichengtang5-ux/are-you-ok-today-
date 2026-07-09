import { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { contactApi } from '@/services/api.types';
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
    setContacts,
    refreshSubscription,
  } = useStore();

  useEffect(() => {
    if (user) {
      refreshSubscription();
    }
  }, [user, refreshSubscription]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      contactApi.list()
        .then((latest) => {
          if (!cancelled) setContacts(latest);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [setContacts]),
  );

  const isPremium = !!subscription?.isPremium;
  const planLabel = PLAN_LABEL[subscription?.plan ?? 'free'] ?? '免费版';
  const endLabel = formatEnd(subscription?.currentPeriodEnd);
  const goHome = () => router.replace('/(tabs)');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="设置" showMascot={false} onBack={goHome} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Guard settings */}
        <Card title="守护设置" style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push('/settings/edit-reminder')}
            accessibilityRole="button"
            accessibilityLabel="编辑提醒时间"
          >
            <Text style={styles.settingLabel}>提醒时间</Text>
            <View style={styles.settingValueRow}>
              <Text style={styles.settingValue}>
                {reminder.startTime} - {reminder.endTime}
              </Text>
              <Text style={styles.chevron}>→</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push('/settings/edit-address')}
            accessibilityRole="button"
            accessibilityLabel="编辑当前住址"
          >
            <Text style={styles.settingLabel}>当前住址</Text>
            <View style={styles.settingValueRow}>
              <Text style={styles.settingValue} numberOfLines={1}>
                {user?.address || '未设置'}
              </Text>
              <Text style={styles.chevron}>→</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.settingRow}
            onPress={() => router.push('/settings/edit-contact')}
            accessibilityRole="button"
            accessibilityLabel="编辑紧急联系人"
          >
            <Text style={styles.settingLabel}>紧急联系人</Text>
            <View style={styles.settingValueRow}>
              <Text style={styles.settingValue} numberOfLines={1}>
                {contacts[0]?.name || '未设置'}
              </Text>
              <Text style={styles.chevron}>→</Text>
            </View>
          </Pressable>
        </Card>

        {/* Subscription */}
        <Card title="订阅" style={styles.card}>
          <View style={styles.subRow}>
            <View style={styles.subInfo}>
              <View
                style={[
                  styles.statusTag,
                  { backgroundColor: isPremium ? Colors.primaryLight : Colors.gray100 },
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
              {endLabel && (
                <Text style={styles.subEndLabel}>
                  {subscription?.status === 'trial' ? '试用截止' : '有效期至'} {endLabel}
                </Text>
              )}
            </View>
            {!isPremium && (
              <Pressable
                style={styles.upgradeBtn}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.upgradeBtnText}>
                  {subscription?.status === 'expired' ? '重新开通' : '升级'}
                </Text>
              </Pressable>
            )}
          </View>
          {isPremium && subscription?.status !== 'cancelled' && (
            <Pressable
              style={styles.subActionRow}
              onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
            >
              <Text style={styles.subActionText}>在 Apple 账户中管理订阅 →</Text>
            </Pressable>
          )}
        </Card>

        {/* Legal & data */}
        <Card title="法律与数据" style={styles.card}>
          <Pressable style={styles.linkRow} onPress={() => Alert.alert('用户协议', '正式协议将在应用上线后发布')}>
            <Text style={styles.linkText}>查看协议</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Alert.alert('隐私政策', '隐私政策将在应用上线后发布')}>
            <Text style={styles.linkText}>隐私政策</Text>
          </Pressable>
          <Pressable
            style={styles.dangerLinkRow}
            onPress={() => router.push('/settings/delete-confirm')}
          >
            <Text style={styles.dangerLinkText}>删除我的数据</Text>
          </Pressable>
        </Card>

        {/* Version */}
        <Text style={styles.version}>今天还好 v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },
  card: { gap: Spacing.sm },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  settingLabel: { fontSize: FontSizes.base, color: Colors.gray700 },
  settingValue: { fontSize: FontSizes.base, fontWeight: FontWeights.medium, color: Colors.gray900 },
  settingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  chevron: { fontSize: FontSizes.base, color: Colors.gray400 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  subInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  subEndLabel: { fontSize: FontSizes.sm, color: Colors.gray500 },
  upgradeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeBtnText: { fontSize: FontSizes.sm, color: Colors.white, fontWeight: FontWeights.semibold },
  subActionRow: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  subActionText: { fontSize: FontSizes.base, color: Colors.primary, fontWeight: FontWeights.medium },
  linkRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  linkText: { fontSize: FontSizes.base, color: Colors.primary, fontWeight: FontWeights.medium },
  dangerLinkRow: { paddingVertical: Spacing.sm },
  dangerLinkText: { fontSize: FontSizes.base, color: Colors.danger, fontWeight: FontWeights.semibold },
  version: { fontSize: FontSizes.sm, color: Colors.gray500, textAlign: 'center', marginTop: Spacing.xl },
});
