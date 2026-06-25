import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 49,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarActiveTintColor: '#2D9B6E',
        tabBarInactiveTintColor: '#9B9B97',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: () => <Text>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: '关怀看板',
          tabBarIcon: () => <Text>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: () => <Text>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
