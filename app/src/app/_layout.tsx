import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { useStore } from '@/store/useStore';
import { authApi, replyApi } from '@/services/api.types';
import { reportError } from '@/services/errorReporter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingState } from '@/components/ui/States';
import {
  initializeNotifications,
  registerNotificationResponseHandler,
  isReplyOkAction,
} from '@/services/notifications';
import {
  getInitialURL,
  addDeepLinkListener,
  navigateDeepLink,
} from '@/services/deepLink';

export default function RootLayout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const isReady = useRef(false);

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const setTodayStatus = useStore((s) => s.setTodayStatus);

  useEffect(() => {
    const init = async () => {
      await initializeNotifications();

      try {
        const accessToken = await AsyncStorage.getItem('access_token');

        if (accessToken) {
          const userData = await authApi.getMe();
          setUser(userData);
          setOnboardingStep(userData.onboardingStep as any);
          isReady.current = true;

          if (userData.isOnboarded) {
            router.replace('/(tabs)');
          } else {
            router.replace(`/onboarding/${userData.onboardingStep}` as Href);
          }
        } else {
          router.replace('/onboarding/login');
        }
      } catch (e) {
        reportError(e, { scope: 'auth.me' });
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
            setTodayStatus(result.guardStatus as any);
          } catch (e) {
            // 快捷回复"我平安"失败：用户可在 App 内重试，但必须上报（守护链路关键动作）
            reportError(e, { scope: 'notificationAction.reply' });
          }
        }
      },
    );

    const unsubscribeDeepLink = addDeepLinkListener((url) => {
      navigateDeepLink(url, router);
    });

    return () => {
      unsubscribeNotification();
      unsubscribeDeepLink();
    };
  }, [router, setTodayStatus]);

  if (isLoading) {
    return <LoadingState message="正在加载..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="alert" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="help" />
      <Stack.Screen name="guardian" />
    </Stack>
  );
}
