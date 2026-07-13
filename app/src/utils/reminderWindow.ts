export const REMINDER_HOUR_OPTIONS = Array.from(
  { length: 24 },
  (_, hour) => `${String(hour).padStart(2, '0')}:00`,
);

export function normalizeReminderHour(time: string, fallback = '20:00'): string {
  const hour = Number(time.trim().split(':')[0]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return fallback;
  return `${String(hour).padStart(2, '0')}:00`;
}

export function timeToMinutes(time: string): number {
  const [hourRaw, minuteRaw = '0'] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return Number.NaN;
  }
  return hour * 60 + minute;
}

export function isOvernightReminderWindow(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) < timeToMinutes(startTime);
}

export function isValidReminderWindow(startTime: string, endTime: string): boolean {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && startMinutes !== endMinutes;
}

export function formatReminderWindowEnd(startTime: string, endTime: string): string {
  const normalizedStart = normalizeReminderHour(startTime);
  const normalizedEnd = normalizeReminderHour(endTime, '22:00');
  return isOvernightReminderWindow(normalizedStart, normalizedEnd)
    ? `次日 ${normalizedEnd}`
    : normalizedEnd;
}

export function formatReminderWindow(startTime: string, endTime: string): string {
  const normalizedStart = normalizeReminderHour(startTime);
  return `${normalizedStart} - ${formatReminderWindowEnd(normalizedStart, endTime)}`;
}

export function formatReminderTimeOfDay(time: string): string {
  const normalized = normalizeReminderHour(time);
  const hour = Number(normalized.slice(0, 2));
  const period =
    hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour === 12 ? '中午' : hour < 18 ? '下午' : '晚上';
  return `${period} ${normalized}`;
}

export function formatReminderWindowSummary(startTime: string, endTime: string): string {
  const normalizedStart = normalizeReminderHour(startTime);
  const normalizedEnd = normalizeReminderHour(endTime, '22:00');
  const endLabel = formatReminderTimeOfDay(normalizedEnd);
  return isOvernightReminderWindow(normalizedStart, normalizedEnd)
    ? `${formatReminderTimeOfDay(normalizedStart)} 至 次日${endLabel}`
    : `${formatReminderTimeOfDay(normalizedStart)} 至 ${endLabel}`;
}

export function formatNextReminderOccurrence(time: string, now = new Date()): string {
  const normalized = normalizeReminderHour(time);
  const hour = Number(normalized.slice(0, 2));
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  const isToday =
    next.getFullYear() === now.getFullYear() &&
    next.getMonth() === now.getMonth() &&
    next.getDate() === now.getDate();
  const period = formatReminderTimeOfDay(normalized).split(' ')[0];

  if (isToday) {
    return hour >= 18 ? `今晚 ${normalized}` : `今天${period} ${normalized}`;
  }
  return hour >= 18 ? `明晚 ${normalized}` : `明天${period} ${normalized}`;
}
