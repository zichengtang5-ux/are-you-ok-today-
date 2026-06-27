import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../theme';

export function StepDots({ current, total = 5 }: { current: number; total?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current - 1 ? styles.active : i < current - 1 ? styles.done : styles.pending,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  active: {
    width: 24,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  done: {
    backgroundColor: Colors.primary,
  },
  pending: {
    backgroundColor: Colors.gray300,
  },
});
