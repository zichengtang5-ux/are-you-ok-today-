import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { Colors } from '../../theme';
import { MascotLogo } from './MascotLogo';

type BarVariant = 'primary' | 'warn' | 'danger' | 'white';

const BG: Record<BarVariant, string> = {
  primary: Colors.primary,
  warn: Colors.warm,
  danger: Colors.danger,
  white: Colors.white,
};
const TEXT: Record<BarVariant, string> = {
  primary: Colors.white,
  warn: Colors.white,
  danger: Colors.white,
  white: Colors.gray900,
};

export function GreenStatusBar({
  variant = 'primary',
  title = '今天还好',
  showMascot = true,
  onBack,
}: {
  variant?: BarVariant;
  title?: string;
  showMascot?: boolean;
  onBack?: () => void;
}) {
  const textColor = TEXT[variant];
  return (
    <View style={[styles.bar, { backgroundColor: BG[variant] }]}>
      <StatusBar
        barStyle={variant === 'white' ? 'dark-content' : 'light-content'}
        backgroundColor={BG[variant]}
      />
      {onBack && (
        <Text onPress={onBack} style={[styles.back, { color: textColor }]}>
          ←
        </Text>
      )}
      {showMascot && variant !== 'white' && (
        <View style={styles.mascot}>
          <MascotLogo size="sm" />
        </View>
      )}
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    position: 'relative',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
  mascot: {
    marginRight: 6,
  },
  back: {
    position: 'absolute',
    left: 16,
    fontSize: 20,
    fontWeight: '400',
  },
});
