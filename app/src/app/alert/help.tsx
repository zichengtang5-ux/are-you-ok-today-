import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, Button, LoadingState, ErrorState } from '@/components/ui';
import { alertApi, type AlertHelpResponse, type SuggestedAction } from '@/services/api.types';
import { openExternalUrl } from '@/services/linking';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

const ACTION_EMOJI: Record<string, string> = {
  call_user: '📞',
  call_120: '🚑',
  call_contact: '👥',
};

const ACTION_BUTTON_LABEL: Record<string, string> = {
  call_user: '拨号 →',
  call_120: '拨号 →',
  call_contact: '查看 →',
};

interface ActionItemProps {
  emoji: string;
  label: string;
  detail?: string;
  actionLabel: string;
  actionColor?: string;
  onPress: () => void;
}

function ActionItem({ emoji, label, detail, actionLabel, actionColor = Colors.primary, onPress }: ActionItemProps) {
  return (
    <View style={styles.actionItem}>
      <View style={styles.actionInfo}>
        <Text style={styles.actionEmoji}>{emoji}</Text>
        <View style={styles.actionText}>
          <Text style={styles.actionLabel}>{label}</Text>
          {detail && <Text style={styles.actionDetail}>{detail}</Text>}
        </View>
      </View>
      <Pressable
        onPress={onPress}
        style={[styles.actionButton, { borderColor: actionColor }]}
      >
        <Text style={[styles.actionButtonText, { color: actionColor }]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function maskPhone(phone: string): string {
  if (phone.length >= 7) {
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }
  return phone;
}

function renderAction(action: SuggestedAction): ActionItemProps | null {
  switch (action.type) {
    case 'call_user':
      return {
        emoji: ACTION_EMOJI.call_user,
        label: action.label,
        detail: action.phone ? maskPhone(action.phone) : undefined,
        actionLabel: ACTION_BUTTON_LABEL.call_user,
        onPress: () => {
          if (action.phone) void openExternalUrl(`tel:${action.phone}`, '当前设备无法拨打电话');
        },
      };

    case 'call_120':
      return {
        emoji: ACTION_EMOJI.call_120,
        label: action.label,
        detail: action.address ?? undefined,
        actionLabel: ACTION_BUTTON_LABEL.call_120,
        actionColor: Colors.danger,
        onPress: () => void openExternalUrl('tel:120', '当前设备无法拨打电话'),
      };

    case 'call_contact':
      return {
        emoji: ACTION_EMOJI.call_contact,
        label: action.label,
        detail: action.contacts?.map((c) => `${c.name} ${maskPhone(c.phone)}`).join('、'),
        actionLabel: ACTION_BUTTON_LABEL.call_contact,
        onPress: () => {
          const first = action.contacts?.[0];
          if (first?.phone) void openExternalUrl(`tel:${first.phone}`, '当前设备无法拨打电话');
        },
      };

    default:
      return null;
  }
}

export default function AlertHelpScreen() {
  const router = useRouter();
  const { alertId, contactId } = useLocalSearchParams<{ alertId?: string; contactId?: string }>();

  const [helpData, setHelpData] = useState<AlertHelpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!alertId || !contactId) {
      setError('缺少告警信息');
      setLoading(false);
      return;
    }

    alertApi.needHelp(alertId, contactId)
      .then((data) => setHelpData(data))
      .catch((err: any) => {
        const message = err.response?.data?.message || '获取帮助信息失败';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [alertId, contactId]);

  if (loading) {
    return <LoadingState message="获取帮助信息..." />;
  }

  if (error && !helpData) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={error} onRetry={() => router.back()} />
      </SafeAreaView>
    );
  }

  const actions = helpData?.suggestedActions ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.title}>需要帮助</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Danger banner */}
        <Card variant="danger" style={styles.banner}>
          <Text style={styles.bannerText}>
            🚨 联系不上对方，请按照以下建议行动
          </Text>
        </Card>

        {/* Dynamic action list */}
        {actions.length > 0 ? (
          <Card style={styles.actionCard}>
            {actions.map((action, index) => {
              const props = renderAction(action);
              if (!props) return null;
              return (
                <ActionItem
                  key={`${action.type}-${index}`}
                  {...props}
                />
              );
            })}
          </Card>
        ) : (
          <Card style={styles.actionCard}>
            <ActionItem
              emoji="📞"
              label="拨打 120 急救"
              actionLabel="拨号 →"
              actionColor={Colors.danger}
              onPress={() => void openExternalUrl('tel:120', '当前设备无法拨打电话')}
            />
          </Card>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          目前暂不支持自动拨打120，如需紧急救援请手动拨打
        </Text>

        {/* Back button */}
        <Button
          variant="ghost"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          返回告警页
        </Button>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  banner: {
    marginBottom: Spacing.sm,
  },
  bannerText: {
    fontSize: FontSizes.base,
    color: Colors.dangerDark,
    fontWeight: FontWeights.semibold,
  },
  actionCard: {
    gap: Spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  actionDetail: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  disclaimer: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  backBtn: {
    marginTop: Spacing.md,
  },
});
