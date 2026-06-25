import { Stack } from 'expo-router';
import { Colors } from '@/theme';

export default function AlertLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_bottom',
      }}
    />
  );
}
