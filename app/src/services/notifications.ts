import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { deviceApi } from './api.types';

const CATEGORY_ID = 'daily_reminder';
const ACTION_REPLY_OK = 'reply_ok';
const ACTION_OPEN_APP = 'open_app';

/* ──────────────── Permission Request ──────────────── */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return status === 'granted';
}

/* ──────────────── Notification Categories (Actions) ──────────────── */
export async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: ACTION_REPLY_OK,
      buttonTitle: '今天还好 ✓',
      options: {
        opensAppToForeground: false,
        isDestructive: false,
        isAuthenticationRequired: false,
      },
    },
    {
      identifier: ACTION_OPEN_APP,
      buttonTitle: '打开应用',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
}

/* ──────────────── Schedule Daily Reminder ──────────────── */
export async function scheduleDailyReminder(
  startTime: string,
  endTime: string,
): Promise<string | null> {
  try {
    const [hours, minutes] = startTime.split(':').map(Number);

    await cancelAllScheduledReminders();

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '今天还好吗？',
        body: '点一下告诉关心你的人你没事',
        data: { type: 'daily_reminder' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: CATEGORY_ID,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Failed to schedule reminder:', error);
    return null;
  }
}

/* ──────────────── Cancel All Reminders ──────────────── */
export async function cancelAllScheduledReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      const data = notification.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'daily_reminder') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error('Failed to cancel reminders:', error);
  }
}

/* ──────────────── Cancel Specific Reminder ──────────────── */
export async function cancelDailyReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel reminder:', error);
  }
}

/* ──────────────── Notification Response Handler ──────────────── */
type NotificationActionCallback = (actionIdentifier: string) => void | Promise<void>;

export function registerNotificationResponseHandler(
  callback: NotificationActionCallback,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const actionId = response.actionIdentifier;
      callback(actionId);
    },
  );

  return () => subscription.remove();
}

export function isReplyOkAction(actionIdentifier: string): boolean {
  return actionIdentifier === ACTION_REPLY_OK;
}

export function isOpenAppAction(actionIdentifier: string): boolean {
  return actionIdentifier === ACTION_OPEN_APP;
}

/* ──────────────── Device Token Registration ──────────────── */
export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

export async function registerDeviceToken(): Promise<boolean> {
  try {
    const token = await getPushToken();
    if (!token) return false;

    await deviceApi.register({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });

    return true;
  } catch (error) {
    console.error('Failed to register device token:', error);
    return false;
  }
}

/* ──────────────── Get Permission Status ──────────────── */
export async function getNotificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/* ──────────────── Initialize All ──────────────── */
export async function initializeNotifications(): Promise<void> {
  await setupNotificationCategories();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}
