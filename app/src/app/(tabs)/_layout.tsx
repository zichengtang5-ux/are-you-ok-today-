import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import { Colors } from '@/theme';

type IconVariant = 'home' | 'dashboard' | 'settings';

function TabIcon({ variant, focused }: { variant: IconVariant; focused: boolean }) {
  const stroke = focused ? Colors.primary : Colors.gray400;
  const fill = focused ? Colors.primaryLight : Colors.gray100;
  const accent = focused ? Colors.primary : Colors.gray500;

  if (variant === 'home') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
          stroke={stroke}
          strokeWidth={1.8}
          fill={fill}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (variant === 'dashboard') {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={3} width={7} height={9} rx={1.5} stroke={stroke} strokeWidth={1.8} fill={fill} />
        <Rect x={14} y={3} width={7} height={5} rx={1.5} stroke={stroke} strokeWidth={1.8} fill={fill} />
        <Rect x={14} y={12} width={7} height={9} rx={1.5} stroke={stroke} strokeWidth={1.8} fill={fill} />
        <Rect x={3} y={16} width={7} height={5} rx={1.5} stroke={stroke} strokeWidth={1.8} fill={fill} />
      </Svg>
    );
  }

  // settings — gear
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={accent} strokeWidth={1.8} fill={fill} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        stroke={stroke}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          borderTopColor: Colors.gray200,
          backgroundColor: Colors.white,
          paddingTop: 6,
          paddingBottom: 12,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ focused }) => <TabIcon variant="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: '看板',
          tabBarIcon: ({ focused }) => <TabIcon variant="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ focused }) => <TabIcon variant="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
