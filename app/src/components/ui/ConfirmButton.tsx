import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Colors, Spacing, FontSizes, FontWeights, Radius, Shadows } from '@/theme';

interface ConfirmButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'warm' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  size?: number;
}

export function ConfirmButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 120,
}: ConfirmButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const colorMap = {
    primary: { bg: Colors.primary, pressed: Colors.primaryDark, shadow: Colors.primary },
    warm: { bg: Colors.warm, pressed: Colors.warmDark, shadow: Colors.warm },
    danger: { bg: Colors.danger, pressed: Colors.dangerDark, shadow: Colors.danger },
  };
  const c = colorMap[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start() }
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start() }
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: disabled ? Colors.gray300 : c.bg,
          shadowColor: disabled ? 'transparent' : c.shadow,
        },
      ]}
    >
      <Animated.View style={[styles.inner, { transform: [{ scale }] }]}>
        <Text style={[styles.label, { color: disabled ? Colors.gray500 : Colors.white }]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 60,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    lineHeight: 24,
  },
});
