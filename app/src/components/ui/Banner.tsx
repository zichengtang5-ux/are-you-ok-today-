import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, FontSizes, FontWeights } from '@/theme';

type Variant = 'info' | 'warn' | 'danger';

interface Props {
  children: string;
  variant?: Variant;
  style?: ViewStyle;
}

const variantMap: Record<Variant, { bg: string; text: string; icon: string }> = {
  info: { bg: Colors.primaryLight, text: Colors.primaryDark, icon: 'ℹ️' },
  warn: { bg: Colors.warmLight, text: Colors.warmDark, icon: '⚠️' },
  danger: { bg: Colors.dangerLight, text: Colors.dangerDark, icon: '🚨' },
};

export function Banner({ children, variant = 'info', style }: Props) {
  const v = variantMap[variant];
  return (
    <View style={[styles.banner, { backgroundColor: v.bg }, style]}>
      <Text style={styles.icon}>{v.icon}</Text>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  icon: {
    fontSize: FontSizes.md,
  },
  text: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    flex: 1,
  },
});
