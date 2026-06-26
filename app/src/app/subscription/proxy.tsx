import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  LoadingState,
  ErrorState,
} from '@/components/ui';
import { PlanCard } from '@/components/ui/PlanCard';
import { useStore } from '@/store/useStore';
import { Colors, FontSizes, FontWeights, Spacing, Radius, Shadows } from '@/theme';
import { guardianApi, subscriptionApi } from '@/services/api.types';
import type { GuardianWardResponse } from '@/services/api.types';
import {
  initIap,
  getProducts,
  purchasePlan,
  type ProductPrice,
} from '@/services/iap';
import type { SubscriptionPlan } from '@/services/api.types';

export default function ProxySubscribeScreen() {
  const router = useRouter();
  const { wardId: paramWardId } = useLocalSearchParams<{ wardId?: string }>();
  const { refreshSubscription } = useStore();

  const [wards, setWards] = useState<GuardianWardResponse[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('yearly');
  const [prices, setPrices] = useState<Record<SubscriptionPlan, string>>({
    monthly: '',
    yearly: '',
  });

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化：拉 IAP 价格 + 已绑定守护列表
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initIap();
        const [products, wardList] = await Promise.all([
          getProducts(),
          guardianApi.listWards(),
        ]);
        if (!mounted) return;
        const priceMap: Record<SubscriptionPlan, string> = { monthly: '', yearly: '' };
        products.forEach((p: ProductPrice) => {
          priceMap[p.plan] = p.localizedPrice;
        });
        setPrices(priceMap);
        setWards(wardList);

        // 优先使用 URL 传入的 wardId，否则默认第一个已绑定
        const boundWards = wardList.filter((w) => w.isBound);
        if (paramWardId && boundWards.some((w) => w.id === paramWardId)) {
          setSelectedWardId(paramWardId);
        } else if (boundWards.length > 0) {
          setSelectedWardId(boundWards[0].id);
        }
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message || '加载数据失败');
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [paramWardId]);

  const boundWards = wards.filter((w) => w.isBound);

  const handlePurchase = async () => {
    if (!selectedWardId) return;
    setError(null);
    setPurchasing(true);
    try {
      const result = await purchasePlan(selectedPlan);
      const res = await subscriptionApi.proxySubscribe({
        wardId: selectedWardId,
        transactionId: result.transactionId,
        plan: selectedPlan,
        provider: result.provider,
      });
      // 子女端自己的订阅态不变更；只刷新一次保证一致
      await refreshSubscription();
      router.replace({
        pathname: '/subscription/success',
        params: {
          plan: res.subscription.plan,
          status: res.subscription.status,
          currentPeriodEnd: res.subscription.currentPeriodEnd,
          wardName: res.wardName,
          isProxy: 'true',
        },
      });
    } catch (e) {
      const err = e as any;
      const statusCode = err?.response?.status;
      const msg =
        statusCode === 403
          ? '无权为该用户代付（需先完成守护绑定）'
          : err?.response?.data?.message || err?.message || '购买失败，请重试';
      setError(msg);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState message="正在加载…" />
      </SafeAreaView>
    );
  }

  if (error && boundWards.length === 0 && !prices.yearly) {
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
          <Text style={styles.heroTitle}>为家人开通守护版</Text>
          <Text style={styles.heroSubtitle}>
            代付后，TA 的账号直接解锁守护版全部功能
          </Text>
        </View>

        {/* 选择家人 */}
        {boundWards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>暂无已绑定的家人</Text>
            <Text style={styles.emptyHint}>
              请先创建守护档案，等 TA 接受邀请后再来开通
            </Text>
            <Button variant="primary" onPress={() => router.push('/guardian/create')}>
              创建守护档案
            </Button>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>为谁开通？</Text>
            <View style={styles.wards} accessibilityRole="radiogroup">
              {boundWards.map((w) => {
                const selected = w.id === selectedWardId;
                return (
                  <Pressable
                    key={w.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={purchasing}
                    onPress={() => setSelectedWardId(w.id)}
                    style={[
                      styles.wardCard,
                      selected && styles.wardCardSelected,
                      purchasing && styles.wardCardDisabled,
                    ]}
                  >
                    <View style={styles.wardAvatar}>
                      <Text style={styles.wardAvatarText}>
                        {w.wardName.slice(0, 1)}
                      </Text>
                    </View>
                    <View style={styles.wardInfo}>
                      <Text style={styles.wardName}>{w.wardName}</Text>
                      <Text style={styles.wardMeta}>
                        {w.wardPhone} · {w.relation}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.wardRadio,
                        { color: selected ? Colors.primary : Colors.gray400 },
                      ]}
                    >
                      {selected ? '●' : '○'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {boundWards.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>选择方案</Text>
            <View style={styles.plans} accessibilityRole="radiogroup">
              <PlanCard
                plan="yearly"
                localizedPrice={prices.yearly || undefined}
                selected={selectedPlan === 'yearly'}
                onPress={() => setSelectedPlan('yearly')}
                disabled={purchasing}
              />
              <PlanCard
                plan="monthly"
                localizedPrice={prices.monthly || undefined}
                selected={selectedPlan === 'monthly'}
                onPress={() => setSelectedPlan('monthly')}
                disabled={purchasing}
              />
            </View>

            <View style={styles.cta}>
              <Button
                variant="primary"
                onPress={handlePurchase}
                loading={purchasing}
                disabled={purchasing || !selectedWardId}
              >
                {purchasing ? '正在购买…' : '为 TA 开通'}
              </Button>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </>
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
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
  },
  heroSubtitle: {
    fontSize: FontSizes.base,
    color: Colors.gray600,
  },
  sectionLabel: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.gray800,
  },
  wards: {
    gap: Spacing.sm,
  },
  wardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.gray200,
    ...Shadows.sm,
  },
  wardCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  wardCardDisabled: {
    opacity: 0.5,
  },
  wardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardAvatarText: {
    color: Colors.white,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  wardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    gap: 2,
  },
  wardName: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  wardMeta: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
  },
  wardRadio: {
    fontSize: 22,
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
  emptyBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['2xl'],
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.gray800,
  },
  emptyHint: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});
