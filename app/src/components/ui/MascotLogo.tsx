import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '../../theme';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'default' | 'double-bar';
type ColorScheme = 'green' | 'red';

const SIZES: Record<Size, number> = { sm: 28, md: 48, lg: 120 };

const GRADIENTS: Record<ColorScheme, { ring: [string, string, string]; eye: [string, string] }> = {
  green: {
    ring: ['#A5D6A7', '#66BB6A', '#2E7D32'],
    eye: ['#66BB6A', '#1B5E20'],
  },
  red: {
    ring: ['#EF9A9A', '#EF5350', '#C62828'],
    eye: ['#EF5350', '#B71C1C'],
  },
};

export function MascotLogo({ size = 'md', pulse = false, variant = 'default', colorScheme = 'green' }: { size?: Size; pulse?: boolean; variant?: Variant; colorScheme?: ColorScheme }) {
  const dim = SIZES[size];
  const colors = GRADIENTS[colorScheme];

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

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
  }, [pulse]);

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
      <Svg width={dim} height={dim} viewBox="0 0 100 100" fill="none">
        <Defs>
          <LinearGradient id="mascotGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colors.ring[0]} />
            <Stop offset="50%" stopColor={colors.ring[1]} />
            <Stop offset="100%" stopColor={colors.ring[2]} />
          </LinearGradient>
          <LinearGradient id="eyeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.eye[0]} />
            <Stop offset="100%" stopColor={colors.eye[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="46" stroke="url(#mascotGrad)" strokeWidth="8" fill="none" />
        <Circle cx="50" cy="50" r="40" fill="white" />
        <Rect x="32" y="37" width="10" height="26" rx="5" fill="url(#eyeGrad)" />
        {variant === 'double-bar'
          ? <Rect x="58" y="37" width="10" height="26" rx="5" fill="url(#eyeGrad)" />
          : <Path
              d="M68 41 L58 50 L68 59"
              stroke="url(#eyeGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
        }
      </Svg>
    </View>
  );
}
