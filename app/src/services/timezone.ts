import { reminderApi } from './api.types';
import { reportError } from './errorReporter';

/**
 * 时区处理 —— 覆盖出差/跨时区场景。
 *
 * 后端提醒引擎按 ReminderConfig.timezone 计算触发时刻（P0 已支持任意 IANA 时区）。
 * 前端负责：检测设备当前时区，若与后端记录的不一致（用户出差/移动），
 * 同步更新到后端，使提醒在"用户当前所在时区的设定时间"触发，而非原时区。
 */

/** 获取设备当前 IANA 时区（如 "Asia/Shanghai"、"America/New_York"） */
export function getDeviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}

/** 设备时区是否与后端记录不同（需要同步） */
export function timezoneChanged(currentBackendTz: string | undefined): boolean {
  const device = getDeviceTimezone();
  // 后端无记录时视为需要同步（首次上报）
  return !currentBackendTz || currentBackendTz !== device;
}

/**
 * 若设备时区与后端记录不一致，则同步到后端。
 * 返回是否发生了同步。失败不抛错（上报后静默，不阻断主流程）。
 */
export async function syncTimezoneIfChanged(
  currentBackendTz: string | undefined,
): Promise<boolean> {
  const device = getDeviceTimezone();
  if (currentBackendTz === device) return false;
  try {
    await reminderApi.updateConfig({ timezone: device });
    return true;
  } catch (e) {
    reportError(e, { scope: 'syncTimezone', device, backend: currentBackendTz });
    return false;
  }
}
