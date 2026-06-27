import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '../../theme';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, number> = { sm: 28, md: 48, lg: 120 };
const RING_WIDTH = { sm: 2, md: 3, lg: 4 };

export function MascotLogo({ size = 'md', pulse = false }: { size?: Size; pulse?: boolean }) {
  const dim = SIZES[size];
  const ring = RING_WIDTH[size];
  const inner = dim - ring * 2;

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

  const checkSize = dim * 0.25;
  const barWidth = dim * 0.08;
  const barHeight = dim * 0.22;

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
      <View
        style={{
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          borderWidth: ring,
          borderColor: Colors.primary,
          backgroundColor: Colors.white,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: dim * 0.06,
        }}
      >
        <View
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: barWidth / 2,
            backgroundColor: Colors.primaryDark,
          }}
        />
        <View
          style={{
            width: checkSize,
            height: checkSize * 1.2,
            borderRightWidth: barWidth * 1.2,
            borderBottomWidth: barWidth * 1.2,
            borderColor: Colors.primaryDark,
            transform: [{ rotate: '45deg' }],
            marginTop: -checkSize * 0.3,
          }}
        />
      </View>
    </View>
  );
}
