import {
  formatReminderWindowEnd,
  isOvernightReminderWindow,
  isValidReminderWindow,
} from '../reminderWindow';

describe('reminderWindow', () => {
  it('accepts a window that ends on the next day', () => {
    expect(isValidReminderWindow('23:00', '01:00')).toBe(true);
    expect(isOvernightReminderWindow('23:00', '01:00')).toBe(true);
    expect(formatReminderWindowEnd('23:00', '01:00')).toBe('次日 01:00');
  });

  it('rejects a zero-length window', () => {
    expect(isValidReminderWindow('20:00', '20:00')).toBe(false);
  });
});
