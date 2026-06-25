import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSizes, FontWeights } from '@/theme';

interface Props {
  count: number;
}

export function StreakBadge({ count }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.icon}>🔥</Text>
      <Text style={styles.text}>已连续 {count} 天平安</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.warmLight,
    borderRadius: 999,
    alignSelf: 'center',
  },
  icon: {
    fontSize: FontSizes.base,
  },
  text: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.warmDark,
  },
});
