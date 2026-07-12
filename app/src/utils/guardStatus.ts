import type { ReminderConfig, ReplyStatus } from '@/types';

type ReminderWindowStatus = Extract<ReplyStatus, 'idle' | 'waiting'>;

export function getPauseDaysRemaining(
  pauseEndAt?: string | null,
  now = new Date(),
): number | null {
  if (!pauseEndAt) return null;
  const endTime = new Date(pauseEndAt).getTime();
  if (Number.isNaN(endTime)) return null;
  return Math.max(0, Math.ceil((endTime - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export function getReminderWindowStatus(
  reminderConfig: Pick<ReminderConfig, 'startTime' | 'endTime'>,
  now = new Date(),
): ReminderWindowStatus {
  const [startHour, startMinute] = reminderConfig.startTime.split(':').map(Number);
  const [endHour, endMinute] = reminderConfig.endTime.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return 'waiting';
  }
  return 'idle';
}

export function computeEffectiveStatus(
  backendStatus: string,
  reminderConfig?: Pick<ReminderConfig, 'startTime' | 'endTime'>,
  now = new Date(),
): ReplyStatus {
  if (backendStatus !== 'idle' || !reminderConfig) {
    return backendStatus as ReplyStatus;
  }
  return getReminderWindowStatus(reminderConfig, now);
}
