import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/* ──────────────── Permission Request ──────────────── */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/* ──────────────── Schedule Daily Reminder ──────────────── */
export async function scheduleDailyReminder(startTime: string, endTime: string): Promise<string | null> {
  try {
    const [hours, minutes] = startTime.split(':').map(Number);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '今天还好吗？',
        body: '点击告诉我你今天平安',
        data: { type: 'daily_reminder' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
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

/* ──────────────── Cancel Reminder ──────────────── */
export async function cancelDailyReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel reminder:', error);
  }
}

/* ──────────────── Notification Action Handler ──────────────── */
export function setupNotificationActions() {
  Notifications.setNotificationCategoryAsync('daily_reminder', [
    {
      identifier: 'reply_ok',
      buttonTitle: '今天还好 ✓',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'open_app',
      buttonTitle: '打开应用',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
}

/* ──────────────── Get Permission Status ──────────────── */
export async function getNotificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}
