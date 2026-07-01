/**
 * 提醒调度时间计算工具。
 *
 * 设计目标：将"何时该检查某用户"从"每分钟全表扫描"转为"按 nextDueAt 索引扫描"。
 * 每个 ReminderConfig 维护一个 nextDueAt（UTC），调度引擎只取到期记录处理，
 * 处理后推进 nextDueAt 到下一个检查点。
 *
 * 同时修复原 cron 硬编码 +8 小时（Asia/Shanghai）的问题：按 config.timezone 计算。
 */

/** 将 "HH:mm" 解析为当天的分钟数 */
export function parseHhmmToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 返回给定 UTC 时刻在指定 IANA 时区下的"本地日期 + 本地分钟数"。
 * 使用 Intl.DateTimeFormat，避免手动加时区偏移（可处理 DST 与任意时区）。
 */
export function getLocalDateParts(
  at: Date,
  timezone: string,
): { dateStr: string; minutesOfDay: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  if (hour === '24') hour = '00'; // 某些环境 midnight 输出 24
  const minute = get('minute');
  return {
    dateStr: `${year}-${month}-${day}`,
    minutesOfDay: Number(hour) * 60 + Number(minute),
  };
}

/**
 * 给定本地日期字符串 (YYYY-MM-DD)、时区、当天分钟数，求对应的 UTC 时刻。
 * 通过"猜测 UTC → 校正偏移"的方式得到精确 UTC（处理时区偏移）。
 */
export function localDateTimeToUtc(
  dateStr: string,
  minutesOfDay: number,
  timezone: string,
): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const hh = Math.floor(minutesOfDay / 60);
  const mm = minutesOfDay % 60;
  // 先按 UTC 构造一个候选时刻
  const guess = Date.UTC(y, mo - 1, d, hh, mm, 0);
  // 计算该候选时刻在目标时区的本地分钟，与期望值的差即为需要校正的偏移
  const local = getLocalDateParts(new Date(guess), timezone);
  const localMin = local.minutesOfDay;
  // 同日内的偏移差（跨日由毫秒差自然处理）
  const expected = minutesOfDay;
  let diffMin = expected - localMin;
  // 处理跨午夜回绕
  if (diffMin > 720) diffMin -= 1440;
  if (diffMin < -720) diffMin += 1440;
  return new Date(guess + diffMin * 60_000);
}

/**
 * 计算某用户下一次应被调度引擎检查的 UTC 时刻。
 *
 * 检查点语义：到达 endTime 时若未回复 → 进入 grace 并发关怀提醒；
 *            到达 endTime + grace 时若仍未回复 → 触发告警。
 * 因此最早的有意义检查点是"今天的 endTime"；若今天 endTime 已过，则是"明天的 endTime"。
 * grace deadline 的检查通过 nextDueAt 在 grace 阶段被推进到 endTime+grace 来覆盖。
 *
 * @param from 计算基准（通常为 now）
 * @param endTime "HH:mm"
 * @param timezone IANA 时区
 */
export function computeNextEndTimeDueAt(
  from: Date,
  endTime: string,
  timezone: string,
): Date {
  const endMin = parseHhmmToMinutes(endTime);
  const local = getLocalDateParts(from, timezone);
  if (local.minutesOfDay < endMin) {
    // 今天的 endTime 还没到
    return localDateTimeToUtc(local.dateStr, endMin, timezone);
  }
  // 今天 endTime 已过 → 明天的 endTime
  const next = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const nextLocal = getLocalDateParts(next, timezone);
  return localDateTimeToUtc(nextLocal.dateStr, endMin, timezone);
}

/** grace deadline 的 UTC 时刻（基于今天的 endTime + grace 分钟） */
export function computeGraceDeadlineDueAt(
  dateStr: string,
  endTime: string,
  gracePeriodMin: number,
  timezone: string,
): Date {
  const endMin = parseHhmmToMinutes(endTime);
  return localDateTimeToUtc(dateStr, endMin + gracePeriodMin, timezone);
}

/**
 * userId 是否归属当前实例的分片（多实例水平扩展时避免重复触发）。
 * 用简单的字符串 hash 取模，保证同一 userId 始终落在同一分片。
 */
export function isInShard(userId: string, shardIndex: number, shardTotal: number): boolean {
  if (shardTotal <= 1) return true;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % shardTotal === shardIndex;
}
