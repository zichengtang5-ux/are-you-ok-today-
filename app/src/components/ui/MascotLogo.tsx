import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../../theme';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Variant = 'default' | 'double-bar';
type ColorScheme = 'green' | 'red';

const SIZES: Record<Size, number> = { sm: 28, md: 48, lg: 120, xl: 152 };

const LOGOS: Record<Variant, number> = {
  default: require('../../../assets/images/logo-white-bg.png'),
  'double-bar': require('../../../assets/images/logo-double-bar-white-bg.png'),
};

export function MascotLogo({ size = 'md', pulse = false, variant = 'default' }: { size?: Size; pulse?: boolean; variant?: Variant; colorScheme?: ColorScheme }) {
  const dim = SIZES[size];

  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const pulseOpacity = useMemo(() => new Animated.Value(0.5), []);

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.5, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim, pulseOpacity]);

  return (
    <View style={{ width: dim + 24, height: dim + 24, alignItems: 'center', justifyContent: 'center' }}>
      {pulse && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              width: dim + 24,
              height: dim + 24,
              borderRadius: (dim + 24) / 2,
              borderWidth: 2,
              borderColor: Colors.primaryLight,
              transform: [{ scale: pulseAnim }],
              opacity: pulseOpacity,
            },
          ]}
        />
      )}
      <Image
        source={LOGOS[variant]}
        contentFit="cover"
        recyclingKey={variant}
        style={{ width: dim, height: dim, borderRadius: dim / 2 }}
      />
    </View>
  );
}
