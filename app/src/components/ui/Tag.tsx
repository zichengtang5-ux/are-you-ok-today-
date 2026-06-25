import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSizes, FontWeights, Radius } from '@/theme';

interface TagProps {
  label: string;
  variant?: 'success' | 'warn' | 'danger' | 'info' | 'neutral';
}

const variantMap = {
  success: { bg: Colors.primaryLight, text: Colors.primaryDark },
  warn: { bg: Colors.warmLight, text: Colors.warmDark },
  danger: { bg: Colors.dangerLight, text: Colors.dangerDark },
  info: { bg: Colors.infoLight, text: Colors.info },
  neutral: { bg: Colors.gray100, text: Colors.gray700 },
};

export function Tag({ label, variant = 'neutral' }: TagProps) {
  const v = variantMap[variant];
  return (
    <View style={[styles.tag, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
});
