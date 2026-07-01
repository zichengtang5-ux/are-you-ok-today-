import {
  computeGraceDeadlineDueAt,
  computeNextEndTimeDueAt,
  getLocalDateParts,
  isInShard,
  localDateTimeToUtc,
  parseHhmmToMinutes,
} from './reminder-schedule.util';

describe('reminder-schedule.util', () => {
  it('parseHhmmToMinutes', () => {
    expect(parseHhmmToMinutes('00:00')).toBe(0);
    expect(parseHhmmToMinutes('22:30')).toBe(22 * 60 + 30);
  });

  it('getLocalDateParts converts UTC to Shanghai local', () => {
    // 2026-06-30T13:00:00Z = 2026-06-30 21:00 Shanghai (UTC+8)
    const at = new Date('2026-06-30T13:00:00Z');
    const r = getLocalDateParts(at, 'Asia/Shanghai');
    expect(r.dateStr).toBe('2026-06-30');
    expect(r.minutesOfDay).toBe(21 * 60);
  });

  it('localDateTimeToUtc round-trips with getLocalDateParts', () => {
    const utc = localDateTimeToUtc('2026-06-30', 22 * 60, 'Asia/Shanghai');
    // 22:00 Shanghai = 14:00 UTC
    expect(utc.toISOString()).toBe('2026-06-30T14:00:00.000Z');
    const back = getLocalDateParts(utc, 'Asia/Shanghai');
    expect(back.dateStr).toBe('2026-06-30');
    expect(back.minutesOfDay).toBe(22 * 60);
  });

  it('computeNextEndTimeDueAt picks today when endTime not yet passed', () => {
    const from = new Date('2026-06-30T10:00:00Z'); // 18:00 Shanghai
    const due = computeNextEndTimeDueAt(from, '22:00', 'Asia/Shanghai');
    expect(due.toISOString()).toBe('2026-06-30T14:00:00.000Z'); // today 22:00
  });

  it('computeNextEndTimeDueAt rolls to tomorrow when endTime passed', () => {
    const from = new Date('2026-06-30T15:00:00Z'); // 23:00 Shanghai, past 22:00
    const due = computeNextEndTimeDueAt(from, '22:00', 'Asia/Shanghai');
    expect(due.toISOString()).toBe('2026-07-01T14:00:00.000Z'); // tomorrow 22:00
  });

  it('computeGraceDeadlineDueAt adds grace minutes', () => {
    const due = computeGraceDeadlineDueAt('2026-06-30', '22:00', 30, 'Asia/Shanghai');
    expect(due.toISOString()).toBe('2026-06-30T14:30:00.000Z'); // 22:30 Shanghai
  });

  it('isInShard is stable and partitions users', () => {
    expect(isInShard('anyuser', 0, 1)).toBe(true); // single shard = always
    const total = 4;
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) {
      for (let s = 0; s < total; s++) {
        if (isInShard(`user-${i}`, s, total)) counts[s]++;
      }
    }
    // 每个用户恰好落在一个分片
    expect(counts.reduce((a, b) => a + b, 0)).toBe(400);
    // 分布大致均匀（不要求严格，但每片都应有用户）
    counts.forEach((c) => expect(c).toBeGreaterThan(0));
  });
});
