import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, LoadingState, ErrorState } from '@/components/ui';
import { PlanCard } from '@/components/ui/PlanCard';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius } from '@/theme';
import {
  initIap,
  getProducts,
  purchasePlan,
  type ProductPrice,
} from '@/services/iap';
import { subscriptionApi } from '@/services/api.types';
import type { SubscriptionPlan } from '@/services/api.types';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { refreshSubscription } = useStore();

  const [selected, setSelected] = useState<SubscriptionPlan>('yearly');
  const [prices, setPrices] = useState<Record<SubscriptionPlan, string>>({
    monthly: '',
    yearly: '',
  });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化 IAP 并拉取最新价格
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initIap();
        const products = await getProducts();
        if (!mounted) return;
        const map: Record<SubscriptionPlan, string> = { monthly: '', yearly: '' };
        products.forEach((p: ProductPrice) => {
          map[p.plan] = p.localizedPrice;
        });
        setPrices(map);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message || '加载价格失败');
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePurchase = async () => {
    setError(null);
    setPurchasing(true);
    try {
      const result = await purchasePlan(selected);
      // 校验 transactionId
      const res = await subscriptionApi.verify({
        transactionId: result.transactionId,
        plan: selected,
        provider: result.provider,
      });
      // 刷新订阅态
      await refreshSubscription();
      router.replace({
        pathname: '/subscription/success',
        params: {
          plan: res.subscription.plan,
          status: res.subscription.status,
          currentPeriodEnd: res.subscription.currentPeriodEnd,
          isTrial: String(!!res.subscription.isTrial),
        },
      });
    } catch (e) {
      const msg = (e as any)?.response?.data?.message || (e as Error).message;
      setError(msg || '购买失败，请重试');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState message="正在加载订阅方案…" />
      </SafeAreaView>
    );
  }

  if (error && !purchasing && prices.monthly === '' && prices.yearly === '') {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={error} onRetry={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="返回"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>守护版</Text>
          <Text style={styles.heroSubtitle}>
            让关心你的人更安心
          </Text>
        </View>

        {/* Plan cards */}
        <View style={styles.plans} accessibilityRole="radiogroup">
          <PlanCard
            plan="yearly"
            localizedPrice={prices.yearly || undefined}
            selected={selected === 'yearly'}
            onPress={() => setSelected('yearly')}
            disabled={purchasing}
          />
          <PlanCard
            plan="monthly"
            localizedPrice={prices.monthly || undefined}
            selected={selected === 'monthly'}
            onPress={() => setSelected('monthly')}
            disabled={purchasing}
          />
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <Button
            variant="primary"
            onPress={handlePurchase}
            loading={purchasing}
            disabled={purchasing}
          >
            {purchasing ? '正在购买…' : '立即开通'}
          </Button>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Legal links */}
        <View style={styles.legal}>
          <Pressable onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdfla/')}>
            <Text style={styles.legalText}>标准 Apple 最终用户许可协议</Text>
          </Pressable>
          <Text style={styles.legalNote}>
            订阅将自动续期，可在 Apple ID 账户设置中随时取消。
          </Text>
        </View>
      </ScrollView>
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
    paddingBottom: Spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
  },
  backText: {
    fontSize: FontSizes.base,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSizes['4xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  heroSubtitle: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
  },
  plans: {
    gap: Spacing.md,
  },
  cta: {
    marginTop: Spacing.sm,
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSizes.sm,
  },
  legal: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  legalText: {
    color: Colors.primary,
    fontSize: FontSizes.sm,
    textDecorationLine: 'underline',
  },
  legalNote: {
    color: Colors.gray500,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});
