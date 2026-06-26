import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const { plan, status, currentPeriodEnd, wardName, isProxy, isTrial } =
    useLocalSearchParams<{
      plan?: string;
      status?: string;
      currentPeriodEnd?: string;
      wardName?: string;
      isProxy?: string;
      isTrial?: string;
    }>();

  const proxy = isProxy === 'true';
  const trial = isTrial === 'true';

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
    } catch {
      return iso;
    }
  };

  const planLabel = plan === 'yearly' ? '年付' : plan === 'monthly' ? '月付' : '—';
  const statusLabel =
    status === 'trial' ? '试用中' : status === 'active' ? '已开通' : status ?? '已开通';
  const headline = proxy
    ? `已为 ${wardName ?? '家人'} 开通守护版`
    : trial
    ? '守护版 · 7 天免费试用已开启'
    : '守护版已开通';

  const handleDone = () => {
    // 回到首页（tabs）
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓</Text>
        </View>

        <Text style={styles.title}>{headline}</Text>
        <Text style={styles.subtitle}>
          {proxy
            ? 'TA 的账号已自动解锁守护版全部功能'
            : '你的账号已解锁守护版全部功能'}
        </Text>

        <View style={styles.summary}>
          <Row label="套餐" value={planLabel} />
          <Row label="状态" value={statusLabel} />
          {currentPeriodEnd && (
            <Row
              label={trial ? '试用截止' : '有效期至'}
              value={formatDate(currentPeriodEnd)}
            />
          )}
        </View>

        <Button variant="primary" onPress={handleDone}>
          返回首页
        </Button>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessibilityRole="text">
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  badgeText: {
    fontSize: 48,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  summary: {
    alignSelf: 'stretch',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  rowLabel: {
    color: Colors.gray600,
    fontSize: FontSizes.base,
  },
  rowValue: {
    color: Colors.gray900,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.medium,
    fontVariant: ['tabular-nums'],
  },
});
