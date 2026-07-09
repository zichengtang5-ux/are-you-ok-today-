import React from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme';

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
  return (
    <View style={styles.headerLogoBadge}>
      <View style={styles.headerLogoBar} />
      <View style={styles.headerLogoChevronTop} />
      <View style={styles.headerLogoChevronBottom} />
    </View>
  );
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
  headerLogoBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.white,
    position: 'relative',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.24,
    shadowRadius: 3,
    elevation: 3,
  },
  headerLogoBar: {
    position: 'absolute',
    left: 8,
    top: 9,
    width: 3.5,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  headerLogoChevronTop: {
    position: 'absolute',
    left: 16,
    top: 10,
    width: 8,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    transform: [{ rotate: '-45deg' }],
  },
  headerLogoChevronBottom: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 8,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    transform: [{ rotate: '45deg' }],
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
