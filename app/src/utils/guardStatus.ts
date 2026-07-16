import type { ReminderConfig, ReplyStatus } from '@/types';
import { isOvernightReminderWindow, timeToMinutes } from '@/utils/reminderWindow';

type ReminderWindowStatus = Extract<ReplyStatus, 'idle' | 'waiting'>;

const GUARD_HEADER_TITLES: Record<ReplyStatus, string> = {
  idle: '今天还好',
  waiting: '等待报平安',
  replied: '已报平安',
  grace: '宽限期提醒',
  alert: '已联系紧急联系人',
  paused: '守护已暂停',
};

export function getGuardHeaderTitle(status: ReplyStatus): string {
  return GUARD_HEADER_TITLES[status];
}

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
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(reminderConfig.startTime);
  const endMinutes = timeToMinutes(reminderConfig.endTime);

  const isInWindow = isOvernightReminderWindow(
    reminderConfig.startTime,
    reminderConfig.endTime,
  )
    ? currentMinutes >= startMinutes || currentMinutes < endMinutes
    : currentMinutes >= startMinutes && currentMinutes < endMinutes;

  if (isInWindow) {
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
