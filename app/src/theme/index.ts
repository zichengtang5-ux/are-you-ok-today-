import { Platform } from 'react-native';

/* ──────────────────────────── Color Palette ──────────────────────────── */
// Guardian Green — warm, natural, evokes safety & life
export const Colors = {
  primary: '#2D9B6E',
  primaryLight: '#E8F5EE',
  primaryDark: '#1F7A52',
  primarySoft: '#5BB88F',

  warm: '#F5A623',
  warmLight: '#FFF5E0',
  warmDark: '#D4881A',

  danger: '#E5484D',
  dangerLight: '#FDE8E9',
  dangerDark: '#C7363A',

  info: '#4A6FA5',
  infoLight: '#E8EEF6',

  // Warm neutrals
  gray50: '#FAFAF8',
  gray100: '#F4F4F2',
  gray200: '#E8E8E5',
  gray300: '#D1D1CE',
  gray400: '#B5B5B0',
  gray500: '#9B9B97',
  gray600: '#7A7A76',
  gray700: '#626260',
  gray800: '#3D3D3A',
  gray900: '#1A1A18',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(26, 26, 24, 0.45)',
} as const;

/* ──────────────────────────── Typography ──────────────────────────── */
export const Fonts = Platform.select({
  ios: {
    rounded: 'ui-rounded',
    sans: 'system-ui',
    serif: 'ui-serif',
    mono: 'ui-monospace',
  },
  default: {
    rounded: 'normal',
    sans: 'normal',
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    rounded: 'var(--font-rounded)',
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    mono: 'var(--font-mono)',
  },
});

export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 17,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 44,
} as const;

export const LineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/* ──────────────────────────── Spacing ──────────────────────────── */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

/* ──────────────────────────── Radius ──────────────────────────── */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const;

/* ──────────────────────────── Shadows ──────────────────────────── */
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  glowWarm: {
    shadowColor: Colors.warm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

/* ──────────────────────────── Layout ──────────────────────────── */
export const Layout = {
  screenWidth: 375,
  contentPadding: Spacing.lg,
  bottomTabHeight: Platform.select({ ios: 49, android: 56 }) ?? 56,
  bottomTabInset: Platform.select({ ios: 34, android: 0 }) ?? 0,
  statusBarHeight: Platform.select({ ios: 44, android: 24 }) ?? 44,
};

/* ──────────────────────────── Button variants ──────────────────────────── */
export const ButtonVariants = {
  primary: {
    bg: Colors.primary,
    text: Colors.white,
    pressed: Colors.primaryDark,
  },
  warm: {
    bg: Colors.warm,
    text: Colors.white,
    pressed: Colors.warmDark,
  },
  danger: {
    bg: Colors.danger,
    text: Colors.white,
    pressed: Colors.dangerDark,
  },
  outline: {
    bg: 'transparent',
    text: Colors.primary,
    pressed: Colors.primaryLight,
    border: Colors.primary,
  },
  ghost: {
    bg: 'transparent',
    text: Colors.gray600,
    pressed: Colors.gray100,
  },
} as const;

export const Theme = {
  Colors,
  Fonts,
  FontSizes,
  LineHeights,
  FontWeights,
  Spacing,
  Radius,
  Shadows,
  Layout,
  ButtonVariants,
};

export default Theme;
