import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { useStore } from '@/store/useStore';
import { authApi, replyApi } from '@/services/api.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingState } from '@/components/ui/States';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import {
  initializeNotifications,
  registerNotificationResponseHandler,
  registerDeviceToken,
  setupPushTokenListener,
  isReplyOkAction,
} from '@/services/notifications';
import {
  getInitialURL,
  addDeepLinkListener,
  navigateDeepLink,
} from '@/services/deepLink';
import { authEvents } from '@/services/authEvents';
import type { Guardian, ReplyStatus } from '@/types';

export default function RootLayout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const isReady = useRef(false);

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const setTodayStatus = useStore((s) => s.setTodayStatus);
  const setGuardians = useStore((s) => s.setGuardians);

  useEffect(() => {
    const init = async () => {
      await initializeNotifications();

      try {
        const accessToken = await AsyncStorage.getItem('access_token');

        if (accessToken) {
          const userData = await authApi.getMe();
          setUser(userData);
          setOnboardingStep(userData.onboardingStep as any);

          const guardians: Guardian[] = (userData.guardianOf ?? []).map((g: any) => ({
            id: g.id,
            wardName: g.ward?.nickname || g.ward?.phone || '未知',
            wardPhone: g.ward?.phone || '',
            relation: g.relation,
            status: (g.status || 'idle') as ReplyStatus,
            lastReplyAt: g.lastReplyAt,
            streak: 0,
            reminderConfig: g.reminderConfig || { startTime: '20:00', endTime: '22:00', gracePeriodMin: 30 },
            isBound: g.isBound,
          }));
          setGuardians(guardians);

          registerDeviceToken().catch(() => {});

          isReady.current = true;

          if (userData.isOnboarded) {
            router.replace('/(tabs)');
          } else {
            router.replace(`/onboarding/${userData.onboardingStep}` as Href);
          }
        } else {
          router.replace('/onboarding/login');
        }
      } catch {
        router.replace('/onboarding/login');
      } finally {
        setIsLoading(false);
      }

      const initialUrl = await getInitialURL();
      if (initialUrl) {
        navigateDeepLink(initialUrl, router);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const unsubscribeNotification = registerNotificationResponseHandler(
      async (actionId) => {
        if (isReplyOkAction(actionId)) {
          try {
            const result = await replyApi.reply();
            setTodayStatus(result.guardStatus as ReplyStatus);
          } catch {
            // silently fail — user can retry in app
          }
        }
      },
    );

    const unsubscribeDeepLink = addDeepLinkListener((url) => {
      navigateDeepLink(url, router);
    });

    const unsubscribeLogout = authEvents.onLogout(() => {
      setUser(null);
      router.replace('/onboarding/login');
    });

    const unsubscribePushToken = setupPushTokenListener();

    return () => {
      unsubscribeNotification();
      unsubscribeDeepLink();
      unsubscribeLogout();
      unsubscribePushToken();
    };
  }, [router, setTodayStatus, setUser]);

  if (isLoading) {
    return <LoadingState message="正在加载..." />;
  }

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alert" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="help" />
        <Stack.Screen name="guardian" />
      </Stack>
    </ErrorBoundary>
  );
}
