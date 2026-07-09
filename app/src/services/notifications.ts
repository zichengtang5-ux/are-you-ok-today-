import { Platform } from 'react-native';
import { deviceApi } from './api.types';

const isNative = Platform.OS !== 'web';

const CATEGORY_ID = 'daily_reminder';
const ACTION_REPLY_OK = 'reply_ok';
const ACTION_OPEN_APP = 'open_app';

let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
let Constants: typeof import('expo-constants').default | null = null;

async function loadNativeModules(): Promise<boolean> {
  if (Notifications && Device && Constants) return true;
  try {
    const [notifMod, deviceMod, constMod] = await Promise.all([
      import('expo-notifications'),
      import('expo-device'),
      import('expo-constants'),
    ]);
    Notifications = notifMod;
    Device = deviceMod;
    Constants = constMod.default ?? constMod;
    return true;
  } catch (e) {
    console.warn('[notifications] Native modules unavailable:', e);
    return false;
  }
}

/* ──────────────── Permission Request ──────────────── */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative || !(await loadNativeModules())) return false;
  const { status: existingStatus } = await Notifications!.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications!.requestPermissionsAsync({
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
  if (!isNative || !(await loadNativeModules())) return;
  try {
    await Notifications!.setNotificationCategoryAsync(CATEGORY_ID, [
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
  } catch (e) {
    console.warn('[notifications] setupNotificationCategories failed:', e);
  }
}

/* ──────────────── Schedule Daily Reminder ──────────────── */
export async function scheduleDailyReminder(
  startTime: string,
  endTime: string,
): Promise<string | null> {
  if (!isNative || !(await loadNativeModules())) return null;
  try {
    const [hours, minutes] = startTime.split(':').map(Number);

    await cancelAllScheduledReminders();

    const notificationId = await Notifications!.scheduleNotificationAsync({
      content: {
        title: '今天还好吗？',
        body: '点一下告诉关心你的人你没事',
        data: { type: 'daily_reminder' },
        sound: true,
        priority: Notifications!.AndroidNotificationPriority.HIGH,
        categoryIdentifier: CATEGORY_ID,
      },
      trigger: {
        type: Notifications!.SchedulableTriggerInputTypes.DAILY,
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
  if (!isNative || !(await loadNativeModules())) return;
  try {
    const scheduled = await Notifications!.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      const data = notification.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'daily_reminder') {
        await Notifications!.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error('Failed to cancel reminders:', error);
  }
}

/* ──────────────── Cancel Specific Reminder ──────────────── */
export async function cancelDailyReminder(notificationId: string): Promise<void> {
  if (!isNative || !(await loadNativeModules())) return;
  try {
    await Notifications!.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel reminder:', error);
  }
}

/* ──────────────── Notification Response Handler ──────────────── */
type NotificationActionCallback = (actionIdentifier: string) => void | Promise<void>;

export function registerNotificationResponseHandler(
  callback: NotificationActionCallback,
): () => void {
  if (!isNative) return () => {};
  let subscription: { remove: () => void } | null = null;
  loadNativeModules().then((ok) => {
    if (!ok || !Notifications) return;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const actionId = response.actionIdentifier;
          callback(actionId);
        },
      );
    } catch (e) {
      console.warn('[notifications] registerNotificationResponseHandler failed:', e);
    }
  });
  return () => subscription?.remove();
}

export function isReplyOkAction(actionIdentifier: string): boolean {
  return actionIdentifier === ACTION_REPLY_OK;
}

export function isOpenAppAction(actionIdentifier: string): boolean {
  return actionIdentifier === ACTION_OPEN_APP;
}

/* ──────────────── Device Token Registration ──────────────── */
export async function getPushToken(): Promise<string | null> {
  if (!isNative || !(await loadNativeModules())) return null;
  try {
    if (!Device!.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    const projectId = Constants!.expoConfig?.extra?.eas?.projectId
      ?? (Constants as any).easConfig?.projectId;

    const tokenData = await Notifications!.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

export async function registerDeviceToken(): Promise<boolean> {
  if (!isNative || !(await loadNativeModules())) return false;
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

export function setupPushTokenListener(): () => void {
  if (!isNative) return () => {};
  let subscription: { remove: () => void } | null = null;
  loadNativeModules().then((ok) => {
    if (!ok || !Notifications) return;
    try {
      subscription = Notifications.addPushTokenListener(async () => {
        await registerDeviceToken();
      });
    } catch (e) {
      console.warn('[notifications] setupPushTokenListener failed:', e);
    }
  });
  return () => subscription?.remove();
}

/* ──────────────── Get Permission Status ──────────────── */
export async function getNotificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!isNative || !(await loadNativeModules())) return 'undetermined';
  try {
    const { status } = await Notifications!.getPermissionsAsync();
    return status;
  } catch {
    return 'undetermined';
  }
}

/* ──────────────── Initialize All ──────────────── */
export async function initializeNotifications(): Promise<void> {
  if (!isNative || !(await loadNativeModules())) return;
  try {
    await setupNotificationCategories();

    Notifications!.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications!.AndroidNotificationPriority.HIGH,
      }),
    });
  } catch (e) {
    console.warn('[notifications] initializeNotifications failed:', e);
  }
}
