import { Pressable, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { Colors, Radius, FontSizes, FontWeights } from '@/theme';

type Variant = 'primary' | 'warm' | 'danger' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  children: string;
  variant?: Variant;
  size?: Size;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: Colors.primary, text: Colors.white },
  warm: { bg: Colors.warm, text: Colors.white },
  danger: { bg: Colors.danger, text: Colors.white },
  outline: { bg: 'transparent', text: Colors.primary, border: Colors.primary },
  ghost: { bg: 'transparent', text: Colors.gray600 },
};

const sizeStyles: Record<Size, { py: number; px: number; font: number }> = {
  sm: { py: 10, px: 16, font: FontSizes.sm },
  md: { py: 14, px: 20, font: FontSizes.base },
  lg: { py: 16, px: 24, font: FontSizes.md },
};

export function Button({ children, variant = 'primary', size = 'md', onPress, loading, disabled, style }: Props) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? Colors.primaryDark : v.bg,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          borderWidth: v.border ? 2 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.text, { color: v.text, fontSize: s.font }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: FontWeights.semibold,
  },
});
