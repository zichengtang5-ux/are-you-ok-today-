import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, FontSizes, FontWeights, Radius, Spacing, Shadows } from '@/theme';
import type { SubscriptionPlan as PlanId } from '@/services/api.types';
import { PLAN_DISPLAY } from '@/services/iap.config';

interface Props {
  plan: PlanId;
  /** 覆盖默认本地化价格（来自 StoreKit 查询结果） */
  localizedPrice?: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

export function PlanCard({
  plan,
  localizedPrice,
  selected,
  onPress,
  style,
  disabled,
}: Props) {
  const meta = PLAN_DISPLAY[plan];
  const displayPrice = localizedPrice ?? meta.price;
  const isRecommended = plan === 'yearly';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.name} ${displayPrice}${meta.period}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
        disabled && styles.cardDisabled,
        style,
      ]}
    >
      {isRecommended && (
        <View style={styles.recommendedBadge} accessibilityLabel="推荐方案">
          <Text style={styles.recommendedText}>推荐</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.name}>{meta.name}</Text>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{displayPrice}</Text>
          <Text style={styles.period}>{meta.period}</Text>
        </View>
      </View>

      <Text style={styles.tagline}>{meta.tagline}</Text>

      <View style={styles.divider} />

      <View style={styles.features} accessibilityRole="list">
        {meta.features.map((f) => (
          <View
            key={f.label}
            style={styles.featureRow}
          >
            <Text
              style={[
                styles.featureDot,
                { color: f.included ? Colors.primary : Colors.gray400 },
              ]}
            >
              {f.included ? '✓' : '—'}
            </Text>
            <Text
              style={[
                styles.featureLabel,
                { color: f.included ? Colors.gray800 : Colors.gray500 },
              ]}
            >
              {f.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.gray200,
    ...Shadows.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    ...Shadows.glow,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.warm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderBottomLeftRadius: Radius.md,
  },
  recommendedText: {
    color: Colors.white,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.xs,
  },
  name: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  price: {
    fontSize: FontSizes['3xl'],
    fontWeight: FontWeights.bold,
    color: Colors.gray900,
    fontVariant: ['tabular-nums'],
  },
  period: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
  },
  tagline: {
    fontSize: FontSizes.sm,
    color: Colors.gray600,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray200,
    marginVertical: Spacing.md,
  },
  features: {
    gap: Spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureDot: {
    fontSize: FontSizes.base,
    fontWeight: FontWeights.bold,
    width: 16,
    textAlign: 'center',
  },
  featureLabel: {
    fontSize: FontSizes.base,
    flex: 1,
  },
});
