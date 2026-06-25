import { useEffect, useState } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { useStore } from '@/store/useStore';
import { authApi } from '@/services/api.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingState } from '@/components/ui/States';

export default function RootLayout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('access_token');

        if (accessToken) {
          const userData = await authApi.getMe();
          setUser(userData);
          setOnboardingStep(userData.onboardingStep as any);

          if (userData.isOnboarded) {
            router.replace('/(tabs)');
          } else {
            router.replace(`/onboarding/${userData.onboardingStep}` as Href);
          }
        } else {
          router.replace('/onboarding/login');
        }
      } catch (error) {
        router.replace('/onboarding/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return <LoadingState message="正在加载..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="alert" />
    </Stack>
  );
}
