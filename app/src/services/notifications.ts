import { Platform } from 'react-native';
import { deviceApi } from './api.types';

const isNative = Platform.OS !== 'web';

const CATEGORY_ID = 'daily_reminder';
const GRACE_CATEGORY_ID = 'safety_grace';
const ALERT_CATEGORY_ID = 'safety_alert';
const ACTION_REPLY_OK = 'reply_ok';
const ACTION_OPEN_APP = 'open_app';
const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';
const DAILY_REMINDER_BODY = '一键点击，让我知道你今天还好';
const GUARD_NOTIFICATION_TYPES = new Set(['daily_reminder', 'grace_reminder', 'guard_alert']);
const GUARD_NOTIFICATION_CATEGORIES = new Set([CATEGORY_ID, GRACE_CATEGORY_ID, ALERT_CATEGORY_ID]);

let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
let Constants: typeof import('expo-constants').default | null = null;

function parseReminderTime(time: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw = '0'] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Invalid reminder time: ${time}`);
  }
  return {
    hour: Math.max(0, Math.min(23, hour)),
    minute: Math.max(0, Math.min(59, minute)),
  };
}

export function getDailyReminderTitle(userName?: string | null): string {
  const displayName = userName?.trim() || '你';
  return `「${displayName}」今天还好吗？`;
}

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
    try {
      // Jest's module transform can fail dynamic imports even when the Expo mocks exist.
      Notifications = require('expo-notifications');
      Device = require('expo-device');
      const constMod = require('expo-constants');
      Constants = constMod.default ?? constMod;
      return true;
    } catch {
      console.warn('[notifications] Native modules unavailable:', e);
      return false;
    }
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
        buttonTitle: '今天还好',
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
    const openCheckInAction = [
      {
        identifier: ACTION_OPEN_APP,
        buttonTitle: '打开报平安',
        options: { opensAppToForeground: true },
      },
    ];
    await Promise.all([
      Notifications!.setNotificationCategoryAsync(GRACE_CATEGORY_ID, openCheckInAction),
      Notifications!.setNotificationCategoryAsync(ALERT_CATEGORY_ID, openCheckInAction),
    ]);
  } catch (e) {
    console.warn('[notifications] setupNotificationCategories failed:', e);
  }
}

/* ──────────────── Schedule Daily Reminder ──────────────── */
export async function scheduleDailyReminder(
  startTime: string,
  endTime: string,
  userName?: string | null,
): Promise<string | null> {
  if (!isNative || !(await loadNativeModules())) return null;
  try {
    const { hour, minute } = parseReminderTime(startTime);

    await cancelAllScheduledReminders();

    const notificationId = await Notifications!.scheduleNotificationAsync({
      content: {
        title: getDailyReminderTitle(userName),
        body: DAILY_REMINDER_BODY,
        data: { type: 'daily_reminder', action: ACTION_REPLY_OK, route: 'home' },
        sound: true,
        priority: Notifications!.AndroidNotificationPriority.HIGH,
        categoryIdentifier: CATEGORY_ID,
      },
      trigger: {
        type: Notifications!.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
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

/**
 * Remove already-presented guard notifications after either device confirms safety.
 * This does not cancel the repeating daily schedule, so tomorrow's reminder remains intact.
 */
export async function dismissPresentedGuardNotifications(): Promise<void> {
  if (!isNative || !(await loadNativeModules())) return;
  try {
    const presented = await Notifications!.getPresentedNotificationsAsync();
    const staleGuardNotifications = presented.filter((notification) => {
      const content = notification.request.content;
      const data = content.data as Record<string, unknown> | undefined;
      return GUARD_NOTIFICATION_TYPES.has(String(data?.type ?? ''))
        || GUARD_NOTIFICATION_CATEGORIES.has(content.categoryIdentifier ?? '');
    });

    await Promise.all(
      staleGuardNotifications.map((notification) =>
        Notifications!.dismissNotificationAsync(notification.request.identifier),
      ),
    );
  } catch (error) {
    console.error('Failed to dismiss presented guard notifications:', error);
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
      const getLastResponse =
        (Notifications as any).getLastNotificationResponseAsync
        ?? (Notifications as any).getLastNotificationResponse;
      Promise.resolve(getLastResponse?.()).then((response) => {
        const actionId = response?.actionIdentifier;
        if (actionId) {
          callback(actionId);
          (Notifications as any).clearLastNotificationResponseAsync?.();
        }
      });

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

export function isDefaultNotificationAction(actionIdentifier: string): boolean {
  return actionIdentifier === DEFAULT_ACTION_IDENTIFIER;
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
