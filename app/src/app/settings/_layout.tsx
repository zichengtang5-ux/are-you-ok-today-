import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="delete-confirm" />
      <Stack.Screen name="edit-address" />
      <Stack.Screen name="edit-contact" />
      <Stack.Screen name="edit-reminder" />
      <Stack.Screen name="pause-settings" />
    </Stack>
  );
}
