import {
  computeEffectiveStatus,
  getPauseDaysRemaining,
  getReminderWindowStatus,
} from '../guardStatus';

const reminder = {
  startTime: '20:00',
  endTime: '23:00',
  gracePeriodMin: 30,
};

describe('guardStatus', () => {
  it('rounds a partial pause day up and never returns a negative day count', () => {
    const now = new Date('2026-07-12T10:00:00+08:00');

    expect(getPauseDaysRemaining('2026-07-13T11:00:00+08:00', now)).toBe(2);
    expect(getPauseDaysRemaining('2026-07-12T09:00:00+08:00', now)).toBe(0);
    expect(getPauseDaysRemaining('not-a-date', now)).toBeNull();
  });

  it('restores to waiting only while the reminder window is active', () => {
    expect(getReminderWindowStatus(reminder, new Date('2026-07-12T19:59:00+08:00'))).toBe('idle');
    expect(getReminderWindowStatus(reminder, new Date('2026-07-12T20:00:00+08:00'))).toBe('waiting');
    expect(getReminderWindowStatus(reminder, new Date('2026-07-12T22:59:00+08:00'))).toBe('waiting');
    expect(getReminderWindowStatus(reminder, new Date('2026-07-12T23:00:00+08:00'))).toBe('idle');
  });

  it('treats both sides of midnight as one reminder window', () => {
    const overnightReminder = { ...reminder, startTime: '23:00', endTime: '01:00' };

    expect(getReminderWindowStatus(overnightReminder, new Date('2026-07-12T23:30:00+08:00'))).toBe('waiting');
    expect(getReminderWindowStatus(overnightReminder, new Date('2026-07-13T00:30:00+08:00'))).toBe('waiting');
    expect(getReminderWindowStatus(overnightReminder, new Date('2026-07-13T01:00:00+08:00'))).toBe('idle');
  });

  it('only derives a reminder-window status from an idle backend status', () => {
    const withinWindow = new Date('2026-07-12T21:00:00+08:00');

    expect(computeEffectiveStatus('idle', reminder, withinWindow)).toBe('waiting');
    expect(computeEffectiveStatus('replied', reminder, withinWindow)).toBe('replied');
  });
});
