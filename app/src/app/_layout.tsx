import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { useStore } from '@/store/useStore';
import { authApi, replyApi } from '@/services/api.types';
import { reportError } from '@/services/errorReporter';
import { realtime } from '@/services/realtime';
import { syncTimezoneIfChanged } from '@/services/timezone';
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

          // 建立实时通道（SSE），守护状态/告警变化实时到达，替代 30 秒轮询
          realtime.on((event) => {
            if (event.type === 'alert_triggered') {
              setTodayStatus('alert' as any);
            } else if (event.type === 'status_changed') {
              const status = (event.payload?.status as string) ?? undefined;
              if (status) setTodayStatus(status as any);
            } else if (event.type === 'alert_resolved' || event.type === 'reply_confirmed') {
              setTodayStatus('replied' as any);
            }
          });
          void realtime.connect();

          // 出差/跨时区：若设备时区与后端记录不同，同步到后端，
          // 使提醒按用户当前所在时区触发（后端引擎已按 timezone 计算）
          void syncTimezoneIfChanged((userData as any).reminderConfig?.timezone);

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
    </Stack>
  );
}
