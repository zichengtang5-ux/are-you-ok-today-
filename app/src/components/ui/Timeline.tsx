import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSizes, FontWeights } from '@/theme';
import type { AlertTimelineItem } from '@/types';

interface Props {
  items: AlertTimelineItem[];
}

export function Timeline({ items }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.dot, item.isCurrent && styles.dotCurrent]} />
          {i < items.length - 1 && <View style={styles.line} />}
          <View style={styles.content}>
            <Text style={styles.time}>{item.time}</Text>
            <Text style={[styles.action, item.isCurrent && styles.actionCurrent]}>{item.action}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    minHeight: 56,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gray400,
    marginTop: 6,
  },
  dotCurrent: {
    backgroundColor: Colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  line: {
    position: 'absolute',
    left: 4,
    top: 18,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.gray200,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.md,
  },
  time: {
    fontSize: FontSizes.xs,
    color: Colors.gray500,
    fontWeight: FontWeights.medium,
  },
  action: {
    fontSize: FontSizes.sm,
    color: Colors.gray800,
    marginTop: 2,
  },
  actionCurrent: {
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
});
