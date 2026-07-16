import { useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import { useStore } from '@/store/useStore';
import { authApi, replyApi } from '@/services/api.types';
import { reportError } from '@/services/errorReporter';
import { realtime } from '@/services/realtime';
import { applyRealtimeGuardEvent, refreshGuardState } from '@/services/guardSync';
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
  dismissPresentedGuardNotifications,
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
  const setActiveAlert = useStore((s) => s.setActiveAlert);
  const isOnboarded = useStore((s) => s.isOnboarded);

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
          isReady.current = userData.isOnboarded;
          if (userData.isOnboarded) {
            void refreshGuardState().catch((error) => {
              reportError(error, { scope: 'appLaunch.guardSync' });
            });
          }

          // 建立实时通道（SSE），守护状态/告警变化实时到达，替代 30 秒轮询
          realtime.on((event) => {
            // First switch the visible component immediately, then reconcile counters/metadata.
            applyRealtimeGuardEvent(event);
            void refreshGuardState().catch((error) => {
              reportError(error, { scope: 'realtime.guardSync' });
            });
            // A reachable foreground Watch receives this immediately and refreshes from the server.
            void syncWatchContext({ isOnboarded: true }).catch(() => {});
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
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !isReady.current) return;
      void refreshGuardState().catch((error) => {
        reportError(error, { scope: 'appForeground.guardSync' });
      });
      void syncWatchContext({ isOnboarded: true }).catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isOnboarded) return;
    void AsyncStorage.getItem('access_token').then((token) => {
      if (!token) return;
      isReady.current = true;
      void refreshGuardState().catch((error) => {
        reportError(error, { scope: 'onboardingComplete.guardSync' });
      });
    });
  }, [isOnboarded]);

  useEffect(() => {
    const unsubscribeNotification = registerNotificationResponseHandler(
      async (actionId) => {
        if (isReplyOkAction(actionId)) {
          try {
            const result = await replyApi.reply('notification_action');
            setTodayStatus(result.guardStatus as any);
            setActiveAlert(null);
            await dismissPresentedGuardNotifications();
            void syncWatchContext({ isOnboarded: true }).catch(() => {});
            void refreshGuardState().catch((error) => {
              reportError(error, { scope: 'notificationAction.guardSync' });
            });
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
      isReady.current = false;
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
  }, [router, setActiveAlert, setTodayStatus, setUser]);

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
