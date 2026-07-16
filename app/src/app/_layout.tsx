import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, type Href } from 'expo-router';
import { useStore } from '@/store/useStore';
import { authApi, replyApi } from '@/services/api.types';
import { reportError } from '@/services/errorReporter';
import { realtime } from '@/services/realtime';
import { syncTimezoneIfChanged } from '@/services/timezone';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingState } from '@/components/ui/States';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import {
  initializeNotifications,
  registerNotificationResponseHandler,
  registerDeviceToken,
  setupPushTokenListener,
  isReplyOkAction,
  isOpenAppAction,
  isDefaultNotificationAction,
} from '@/services/notifications';
import {
  getInitialURL,
  addDeepLinkListener,
  navigateDeepLink,
} from '@/services/deepLink';
import { authEvents } from '@/services/authEvents';
import { syncWatchContext } from '@/services/watchSync';

function normalizeOnboardingStep(step: string): string {
  return step === 'agreement' ? 'basic-info' : step;
}

export default function RootLayout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const isReady = useRef(false);

  const setUser = useStore((s) => s.setUser);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const setTodayStatus = useStore((s) => s.setTodayStatus);
  const setContacts = useStore((s) => s.setContacts);
  const setReminder = useStore((s) => s.setReminder);
  const setNotificationAuthorized = useStore((s) => s.setNotificationAuthorized);
  const reply = useStore((s) => s.reply);

  useEffect(() => {
    const init = async () => {
      await initializeNotifications();

      try {
        const accessToken = await AsyncStorage.getItem('access_token');

        if (accessToken) {
          const userData = await authApi.getMe();
          const onboardingStep = normalizeOnboardingStep(userData.onboardingStep);
          setUser(userData);
          setOnboardingStep(onboardingStep as any);
          if ((userData as any).contacts) {
            setContacts((userData as any).contacts);
          }
          if ((userData as any).reminderConfig) {
            setReminder((userData as any).reminderConfig);
          }
          if ((userData as any).guardStatus?.status) {
            setTodayStatus((userData as any).guardStatus.status);
          }
          setNotificationAuthorized(!!(userData as any).notificationAuth);
          void syncWatchContext({ isOnboarded: userData.isOnboarded }).catch(() => {});

          void registerDeviceToken();
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
            router.replace(`/onboarding/${onboardingStep}` as Href);
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
            const result = await replyApi.reply('notification_action');
            reply();
            setTodayStatus(result.guardStatus as any);
          } catch (e) {
            // 快捷回复“今天还好”失败：用户可在 App 内重试，但必须上报（关键签到动作）
            reportError(e, { scope: 'notificationAction.reply' });
          }
          return;
        }

        if (isDefaultNotificationAction(actionId) || isOpenAppAction(actionId)) {
          router.replace('/(tabs)');
        }
      },
    );

    const unsubscribeDeepLink = addDeepLinkListener((url) => {
      navigateDeepLink(url, router);
    });

    const unsubscribeLogout = authEvents.onLogout(() => {
      setUser(null);
      realtime.close();
      router.replace('/onboarding/login');
    });

    const unsubscribePushToken = setupPushTokenListener();

    return () => {
      unsubscribeNotification();
      unsubscribeDeepLink();
      unsubscribeLogout();
      unsubscribePushToken();
    };
  }, [reply, router, setTodayStatus, setUser]);

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
        <Stack.Screen name="settings" />
      </Stack>
    </ErrorBoundary>
  );
}
