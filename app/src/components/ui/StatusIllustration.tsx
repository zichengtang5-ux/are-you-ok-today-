import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/theme';

type Status = 'idle' | 'waiting' | 'replied' | 'grace' | 'alert' | 'paused';

const ICON_SIZE = 64;

function SunIcon() {
  return (
    <View style={[base.circle, { backgroundColor: '#FFD54F' }]}>
      <View style={[base.dot, { width: 20, height: 20, backgroundColor: '#FFA726', borderRadius: 10 }]} />
    </View>
  );
}

function MoonIcon() {
  return (
    <View style={[base.outer, { backgroundColor: '#7986CB' }]}>
      <View style={base.moonMask} />
    </View>
  );
}

function CheckIcon() {
  return (
    <View style={[base.circle, { backgroundColor: Colors.primary }]}>
      <View style={base.checkLong} />
      <View style={base.checkShort} />
    </View>
  );
}

function WarnIcon() {
  return (
    <View style={[base.circle, { backgroundColor: Colors.warm }]}>
      <View style={base.exclBar} />
      <View style={base.exclDot} />
    </View>
  );
}

function AlertIcon() {
  return (
    <View style={[base.circle, { backgroundColor: Colors.danger }]}>
      <View style={base.crossA} />
      <View style={base.crossB} />
    </View>
  );
}

function PauseIcon() {
  return (
    <View style={styles.pauseWrap}>
      <View style={styles.pauseBar} />
      <View style={styles.pauseBar} />
    </View>
  );
}

export function StatusIllustration({ status }: { status: Status }) {
  switch (status) {
    case 'idle': return <SunIcon />;
    case 'waiting': return <MoonIcon />;
    case 'replied': return <CheckIcon />;
    case 'grace': return <WarnIcon />;
    case 'alert': return <AlertIcon />;
    case 'paused': return <PauseIcon />;
  }
}

const base = StyleSheet.create({
  circle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dot: {},
  outer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    overflow: 'hidden',
  },
  moonMask: {
    position: 'absolute',
    width: ICON_SIZE - 10,
    height: ICON_SIZE - 10,
    borderRadius: (ICON_SIZE - 10) / 2,
    backgroundColor: Colors.white,
    top: 0,
    left: 12,
  },
  checkLong: {
    position: 'absolute',
    width: 28,
    height: 4,
    backgroundColor: Colors.white,
    borderRadius: 2,
    left: 14,
    top: 22,
    transform: [{ rotate: '45deg' }],
  },
  checkShort: {
    position: 'absolute',
    width: 12,
    height: 4,
    backgroundColor: Colors.white,
    borderRadius: 2,
    left: 18,
    top: 32,
    transform: [{ rotate: '-45deg' }],
  },
  exclBar: {
    width: 4,
    height: 20,
    backgroundColor: Colors.white,
    borderRadius: 2,
    position: 'absolute',
    top: 16,
  },
  exclDot: {
    width: 5,
    height: 5,
    backgroundColor: Colors.white,
    borderRadius: 3,
    position: 'absolute',
    top: 42,
  },
  crossA: {
    position: 'absolute',
    width: 26,
    height: 4,
    backgroundColor: Colors.white,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  crossB: {
    position: 'absolute',
    width: 26,
    height: 4,
    backgroundColor: Colors.white,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
});

const styles = StyleSheet.create({
  pauseWrap: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  pauseBar: {
    width: 10,
    height: 36,
    borderRadius: 5,
    backgroundColor: Colors.gray400,
  },
});
