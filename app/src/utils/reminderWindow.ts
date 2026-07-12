export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function isOvernightReminderWindow(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) < timeToMinutes(startTime);
}

export function isValidReminderWindow(startTime: string, endTime: string): boolean {
  return timeToMinutes(startTime) !== timeToMinutes(endTime);
}

export function formatReminderWindowEnd(startTime: string, endTime: string): string {
  return isOvernightReminderWindow(startTime, endTime) ? `次日 ${endTime}` : endTime;
}
