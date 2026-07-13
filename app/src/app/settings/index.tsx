import { useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Card } from '@/components/ui';
import { GreenStatusBar } from '@/components/ui/GreenStatusBar';
import { useStore } from '@/store/useStore';
import { contactApi, pauseApi } from '@/services/api.types';
import { getPauseDaysRemaining } from '@/utils/guardStatus';
import { formatReminderWindow } from '@/utils/reminderWindow';
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

function SettingsItem({
  icon,
  label,
  value,
  detail,
  tint = Colors.primary,
  last = false,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  value?: string;
  detail?: string;
  tint?: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, !last && styles.itemBorder, pressed && styles.itemPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.iconBox, { backgroundColor: `${tint}18` }]}>
        <SymbolView name={icon} size={20} tintColor={tint} fallback={<Text style={{ color: tint }}>•</Text>} />
      </View>
      <View style={styles.itemCopy}>
        <Text style={[styles.itemLabel, !value && styles.itemLabelOnly]}>{label}</Text>
        {value ? <Text style={styles.itemValue} numberOfLines={1}>{value}</Text> : null}
        {detail ? <Text style={styles.itemDetail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={Colors.gray400} fallback={<Text style={styles.chevron}>›</Text>} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const {
    user,
    reminder,
    contacts,
    subscription,
    isPaused,
    pauseEndAt,
    daysRemaining,
    setContacts,
    setPauseStatus,
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
      pauseApi.getStatus()
        .then((status) => {
          if (!cancelled) setPauseStatus(status);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [setContacts, setPauseStatus]),
  );

  const isPremium = !!subscription?.isPremium;
  const planLabel = PLAN_LABEL[subscription?.plan ?? 'free'] ?? '免费版';
  const endLabel = formatEnd(subscription?.currentPeriodEnd);
  const goHome = () => router.replace('/(tabs)');
  const pauseDaysRemaining = getPauseDaysRemaining(pauseEndAt) ?? daysRemaining;
  const pauseLabel = isPaused
    ? pauseDaysRemaining != null
      ? `已暂停 · 剩余 ${pauseDaysRemaining} 天`
      : '已暂停'
    : '未暂停';
  const pauseDetail = isPaused && pauseEndAt ? `${formatEnd(pauseEndAt)} 自动恢复` : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GreenStatusBar variant="white" title="设置" showMascot={false} onBack={goHome} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.compactCard}>
          <Text style={styles.sectionTitle}>守护设置</Text>
          <SettingsItem icon="clock.fill" label="提醒时间" value={formatReminderWindow(reminder.startTime, reminder.endTime)} onPress={() => router.push('/settings/edit-reminder')} />
          <SettingsItem icon="location.fill" label="当前住址" value={user?.address || '未设置'} onPress={() => router.push('/settings/edit-address')} />
          <SettingsItem icon="person.crop.circle.fill" label="紧急联系人" value={contacts[0]?.name || '未设置'} last onPress={() => router.push('/settings/edit-contact')} />
        </Card>

        <Card style={styles.singleCard}>
          <SettingsItem icon="pause.circle.fill" label="暂停守护" value={pauseLabel} detail={pauseDetail} tint={Colors.warm} last onPress={() => router.push('/settings/pause-settings')} />
        </Card>

        <Card style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeading}>
            <View style={styles.iconBox}>
              <SymbolView name="shield.checkered" size={20} tintColor={Colors.primary} />
            </View>
            <View style={styles.subscriptionCopy}>
              <Text style={styles.subscriptionTitle}>订阅</Text>
              <Text style={styles.subscriptionHint}>{isPremium ? '5 位联系人与语音告警已开启' : '升级可添加 5 位联系人和语音告警'}</Text>
            </View>
          </View>
          <View style={styles.subscriptionStatusRow}>
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

        <Card style={styles.compactCard}>
          <Text style={styles.sectionTitle}>法律与数据</Text>
          <SettingsItem icon="doc.text.fill" label="用户协议" onPress={() => Alert.alert('用户协议', '正式协议将在应用上线后发布')} />
          <SettingsItem icon="hand.raised.fill" label="隐私政策" onPress={() => Alert.alert('隐私政策', '隐私政策将在应用上线后发布')} />
          <SettingsItem icon="trash.fill" label="删除我的数据" tint={Colors.danger} last onPress={() => router.push('/settings/delete-confirm')} />
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
  scrollContent: { padding: Spacing.md, gap: 12, paddingBottom: Spacing.xl },
  compactCard: { padding: Spacing.md },
  singleCard: { paddingHorizontal: Spacing.md, paddingVertical: 4 },
  sectionTitle: { fontSize: FontSizes.base, color: Colors.gray900, fontWeight: FontWeights.semibold, marginBottom: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    gap: 12,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  itemPressed: { opacity: 0.65 },
  iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, minWidth: 0, gap: 3 },
  itemLabel: { fontSize: FontSizes.sm, color: Colors.gray600 },
  itemLabelOnly: { fontSize: FontSizes.base, color: Colors.gray900, fontWeight: FontWeights.medium },
  itemValue: { fontSize: FontSizes.base, color: Colors.gray900, fontWeight: FontWeights.medium },
  itemDetail: { fontSize: FontSizes.xs, color: Colors.gray500 },
  chevron: { fontSize: FontSizes.base, color: Colors.gray400 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium },
  subscriptionCard: { padding: Spacing.md, gap: 12 },
  subscriptionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subscriptionCopy: { flex: 1, gap: 2 },
  subscriptionTitle: { fontSize: FontSizes.base, color: Colors.gray900, fontWeight: FontWeights.semibold },
  subscriptionHint: { fontSize: FontSizes.xs, color: Colors.gray500 },
  subscriptionStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  version: { fontSize: FontSizes.xs, color: Colors.gray500, textAlign: 'center', marginTop: Spacing.sm },
});
