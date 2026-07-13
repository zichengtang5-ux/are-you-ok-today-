import {
  REMINDER_HOUR_OPTIONS,
  formatNextReminderOccurrence,
  formatReminderTimeOfDay,
  formatReminderWindow,
  formatReminderWindowEnd,
  formatReminderWindowSummary,
  isOvernightReminderWindow,
  isValidReminderWindow,
  normalizeReminderHour,
} from '../reminderWindow';

describe('reminderWindow', () => {
  it('provides every hour in an unambiguous 24-hour HH:00 format', () => {
    expect(REMINDER_HOUR_OPTIONS).toHaveLength(24);
    expect(REMINDER_HOUR_OPTIONS[0]).toBe('00:00');
    expect(REMINDER_HOUR_OPTIONS[11]).toBe('11:00');
    expect(REMINDER_HOUR_OPTIONS[23]).toBe('23:00');
    expect(REMINDER_HOUR_OPTIONS.every((time) => /^([01]\d|2[0-3]):00$/.test(time))).toBe(true);
  });

  it('normalizes saved hour values without converting morning to evening', () => {
    expect(normalizeReminderHour('11')).toBe('11:00');
    expect(normalizeReminderHour('11:30')).toBe('11:00');
    expect(normalizeReminderHour('23')).toBe('23:00');
    expect(normalizeReminderHour('25:00')).toBe('20:00');
  });

  it('describes 11:00 as morning and 23:00 as night', () => {
    expect(formatReminderTimeOfDay('11:00')).toBe('上午 11:00');
    expect(formatReminderTimeOfDay('23:00')).toBe('晚上 23:00');

    const morning = new Date(2026, 6, 13, 8, 0, 0);
    expect(formatNextReminderOccurrence('11:00', morning)).toBe('今天上午 11:00');
    expect(formatNextReminderOccurrence('23:00', morning)).toBe('今晚 23:00');
  });

  it('accepts a window that ends on the next day', () => {
    expect(isValidReminderWindow('23:00', '01:00')).toBe(true);
    expect(isOvernightReminderWindow('23:00', '01:00')).toBe(true);
    expect(formatReminderWindowEnd('23:00', '01:00')).toBe('次日 01:00');
    expect(formatReminderWindow('23:00', '01:00')).toBe('23:00 - 次日 01:00');
    expect(formatReminderWindowSummary('23:00', '01:00')).toBe('晚上 23:00 至 次日凌晨 01:00');
  });

  it('rejects a zero-length window', () => {
    expect(isValidReminderWindow('20:00', '20:00')).toBe(false);
    expect(isValidReminderWindow('not-a-time', '20:00')).toBe(false);
  });
});
