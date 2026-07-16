import { applyGuardSnapshot, applyRealtimeGuardEvent, refreshGuardState } from '../guardSync';
import { useStore } from '@/store/useStore';
import { replyApi } from '../api.types';
import * as notifications from '../notifications';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const snapshot = (status: 'idle' | 'waiting' | 'replied' | 'grace' | 'alert' | 'paused') => ({
  status,
  lastReplyAt: null,
  todayReplied: status === 'replied',
  todayRepliedAt: status === 'replied' ? '2026-07-16T10:00:00.000Z' : null,
  reminderConfig: {
    startTime: '20:00',
    endTime: '22:00',
    gracePeriodMin: 30,
    timezone: 'Asia/Shanghai',
  },
  graceDeadlineAt: status === 'grace' ? '2026-07-16T22:30:00.000Z' : null,
  monthlyStats: { repliedDays: status === 'replied' ? 8 : 7, totalDays: 16, daysInMonth: 31, display: '7/31' },
});

describe('guard state synchronization', () => {
  let mockGetStatus: jest.SpyInstance;
  let mockDismiss: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStatus = jest.spyOn(replyApi, 'getStatus');
    mockDismiss = jest
      .spyOn(notifications, 'dismissPresentedGuardNotifications')
      .mockResolvedValue(undefined);
    useStore.setState({
      todayStatus: 'grace',
      streak: 7,
      activeAlert: { id: 'alert-1' } as never,
      isPaused: false,
      pauseEndAt: null,
      daysRemaining: null,
    });
  });

  afterEach(() => {
    mockGetStatus.mockRestore();
    mockDismiss.mockRestore();
  });

  it('immediately changes a visible grace screen to replied on a Watch reply event', () => {
    const result = applyRealtimeGuardEvent({
      userId: 'u1',
      type: 'reply_confirmed',
      at: '2026-07-16T10:00:00.000Z',
    });

    expect(result).toBe('replied');
    expect(useStore.getState()).toEqual(expect.objectContaining({
      todayStatus: 'replied',
      activeAlert: null,
      isPaused: false,
    }));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('applies pause and resume events from either device', () => {
    applyRealtimeGuardEvent({
      userId: 'u1',
      type: 'status_changed',
      payload: { status: 'paused', pauseEndAt: '2026-07-20T00:00:00.000Z' },
      at: 't1',
    });
    expect(useStore.getState()).toEqual(expect.objectContaining({
      todayStatus: 'paused',
      isPaused: true,
      pauseEndAt: '2026-07-20T00:00:00.000Z',
    }));

    applyRealtimeGuardEvent({
      userId: 'u1',
      type: 'status_changed',
      payload: { status: 'idle' },
      at: 't2',
    });
    expect(useStore.getState()).toEqual(expect.objectContaining({
      todayStatus: 'idle',
      isPaused: false,
      pauseEndAt: null,
    }));
  });

  it('uses the authoritative snapshot for status, streak, reminder, and stale alert cleanup', () => {
    applyGuardSnapshot(snapshot('replied'));

    expect(useStore.getState()).toEqual(expect.objectContaining({
      todayStatus: 'replied',
      streak: 8,
      activeAlert: null,
      reminder: { startTime: '20:00', endTime: '22:00', gracePeriodMin: 30 },
    }));
  });

  it('coalesces simultaneous foreground and SSE refreshes', async () => {
    let resolveRequest!: (value: ReturnType<typeof snapshot>) => void;
    mockGetStatus.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

    const first = refreshGuardState();
    const second = refreshGuardState();
    resolveRequest(snapshot('replied'));

    await Promise.all([first, second]);
    expect(mockGetStatus).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});
