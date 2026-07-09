import React from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme';

const headerLogo = require('../../../assets/images/header-logo.png');

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

function HeaderLogo() {
  return <Image source={headerLogo} style={styles.headerLogo} contentFit="cover" accessibilityLabel="今天还好 logo" />;
}

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
  const { top } = useSafeAreaInsets();
  const textColor = TEXT[variant];
  const barHeight = Math.max(top, 20) + 44;

  return (
    <View style={[styles.bar, { backgroundColor: BG[variant], paddingTop: Math.max(top, 20), height: barHeight }]}>
      <StatusBar
        barStyle={variant === 'white' ? 'dark-content' : 'light-content'}
        backgroundColor={BG[variant]}
      />
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Text style={[styles.back, { color: textColor }]}>←</Text>
        </Pressable>
      )}
      {showMascot && variant !== 'white' && (
        <View style={styles.mascot}>
          <HeaderLogo />
        </View>
      )}
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    position: 'relative',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  mascot: {
    marginRight: 8,
  },
  headerLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.24,
    shadowRadius: 3,
    elevation: 3,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    bottom: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    fontSize: 22,
    fontWeight: '400',
  },
});
