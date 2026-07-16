import { replyApi, type ReplyStatusResponse } from './api.types';
import { dismissPresentedGuardNotifications } from './notifications';
import type { RealtimeEvent } from './realtime';
import { useStore } from '@/store/useStore';
import { computeEffectiveStatus } from '@/utils/guardStatus';
import type { ReplyStatus } from '@/types';

let refreshPromise: Promise<ReplyStatusResponse> | null = null;

/** Apply a complete server snapshot so reopened/foregrounded screens never trust stale local state. */
export function applyGuardSnapshot(data: ReplyStatusResponse): ReplyStatus {
  const state = useStore.getState();
  const status = computeEffectiveStatus(data.status, data.reminderConfig);
  const paused = data.status === 'paused';

  useStore.setState({
    todayStatus: status,
    reminder: {
      startTime: data.reminderConfig.startTime,
      endTime: data.reminderConfig.endTime,
      gracePeriodMin: data.reminderConfig.gracePeriodMin,
    },
    streak: data.monthlyStats.repliedDays,
    activeAlert: data.status === 'alert' ? state.activeAlert : null,
    isPaused: paused,
    pauseEndAt: paused ? state.pauseEndAt : null,
    daysRemaining: paused ? state.daysRemaining : null,
  });

  return status;
}

/** Apply the event immediately; a following snapshot refresh fills in counters and metadata. */
export function applyRealtimeGuardEvent(event: RealtimeEvent): ReplyStatus | null {
  let status: ReplyStatus | null = null;

  if (event.type === 'alert_triggered') {
    status = 'alert';
  } else if (event.type === 'status_changed') {
    const candidate = event.payload?.status;
    if (typeof candidate === 'string') status = candidate as ReplyStatus;
  } else if (event.type === 'alert_resolved' || event.type === 'reply_confirmed') {
    status = 'replied';
  }

  if (!status) return null;

  const paused = status === 'paused';
  useStore.setState({
    todayStatus: status,
    activeAlert: status === 'alert' ? useStore.getState().activeAlert : null,
    isPaused: paused,
    pauseEndAt: paused
      ? (event.payload?.pauseEndAt as string | undefined) ?? useStore.getState().pauseEndAt
      : null,
    daysRemaining: paused ? useStore.getState().daysRemaining : null,
  });

  if (status === 'replied') {
    void dismissPresentedGuardNotifications();
  }

  return status;
}

/** Coalesce simultaneous SSE/foreground refreshes into one authoritative request. */
export async function refreshGuardState(): Promise<ReplyStatusResponse> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const data = await replyApi.getStatus();
    const status = applyGuardSnapshot(data);
    if (status === 'replied') {
      await dismissPresentedGuardNotifications();
    }
    return data;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
