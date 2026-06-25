import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, FontSizes, FontWeights, Shadows } from '@/theme';

type Variant = 'default' | 'warm' | 'danger' | 'info';

interface Props {
  title?: string;
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle;
}

const bgMap: Record<Variant, string> = {
  default: Colors.white,
  warm: Colors.warmLight,
  danger: Colors.dangerLight,
  info: Colors.infoLight,
};

export function Card({ title, children, variant = 'default', style }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: bgMap[variant] }, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
});
