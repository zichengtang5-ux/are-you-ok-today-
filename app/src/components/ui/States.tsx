import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Colors, Spacing, FontSizes } from '@/theme';

export function LoadingState({ message = '加载中...' }: { message?: string } = {}) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message = '暂无数据' }: { message?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function ErrorState({ message = '加载失败', onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.emptyIcon}>😵</Text>
      <Text style={styles.text}>{message}</Text>
      <Text style={styles.subtext}>请检查网络连接后重试</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    minHeight: 200,
  },
  text: {
    fontSize: FontSizes.sm,
    color: Colors.gray500,
    marginTop: Spacing.sm,
  },
  subtext: {
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginTop: Spacing.xs,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
});
