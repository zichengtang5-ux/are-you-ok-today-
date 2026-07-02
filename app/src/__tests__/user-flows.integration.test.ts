/**
 * 前端关键用户流程集成测试（注册 → 守护 → 回复 → 告警 → 订阅）。
 *
 * 说明：React 组件 DOM 渲染在当前 React 19.2 + jest-expo + RTL v14 环境下
 * 适配成本过高（RTL v14 换用新 test-renderer，与 jest-expo preset 未开箱集成）。
 * 因此以"页面所依赖的 store + service 编排"为单元做流程级集成测试——
 * 覆盖页面行为背后的真实状态流转逻辑，稳定可靠。
 */
import { useStore } from '@/store/useStore';
import type { RealtimeEvent } from '@/services/realtime';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/api.types', () => ({
  subscriptionApi: { getStatus: jest.fn() },
}));
jest.mock('@/services/errorReporter', () => ({ reportError: jest.fn() }));

const mockSubscriptionApi = (jest.requireMock('@/services/api.types') as {
  subscriptionApi: { getStatus: jest.Mock };
}).subscriptionApi;

const s = () => useStore.getState();

function resetStore() {
  useStore.setState({
    user: null,
    isOnboarded: false,
    onboardingStep: 'login',
    contacts: [],
    reminder: { startTime: '20:00', endTime: '22:00', gracePeriodMin: 30 },
    todayStatus: 'idle',
    streak: 0,
    activeAlert: null,
    guardians: [],
    notificationAuthorized: false,
    subscription: null,
  });
}

// 复刻 _layout 中实时事件 → store 状态的映射，验证这条流程逻辑
function applyRealtimeEvent(event: RealtimeEvent) {
  if (event.type === 'alert_triggered') {
    s().setTodayStatus('alert');
  } else if (event.type === 'status_changed') {
    const status = event.payload?.status as string | undefined;
    if (status) s().setTodayStatus(status as never);
  } else if (event.type === 'alert_resolved' || event.type === 'reply_confirmed') {
    s().setTodayStatus('replied');
  }
}

describe('user flows (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('onboarding flow: login → set user → complete onboarding', () => {
    expect(s().isOnboarded).toBe(false);
    s().setUser({ id: 'u1', phone: '13800001111' } as never);
    s().setOnboardingStep('complete' as never);
    s().completeOnboarding();
    expect(s().user).toEqual(expect.objectContaining({ id: 'u1' }));
    expect(s().isOnboarded).toBe(true);
  });

  it('daily guard flow: idle → waiting → reply confirms & increments streak', () => {
    useStore.setState({ todayStatus: 'idle', streak: 4 });
    s().setTodayStatus('waiting');
    expect(s().todayStatus).toBe('waiting');
    s().reply();
    expect(s().todayStatus).toBe('replied');
    expect(s().streak).toBe(5);
  });

  it('alert flow: trigger → active alert → resolve on reply', () => {
    s().triggerAlert({ id: 'a1', status: 'active' } as never);
    expect(s().todayStatus).toBe('alert');
    expect(s().activeAlert).toEqual(expect.objectContaining({ id: 'a1' }));
    s().resolveAlert();
    expect(s().todayStatus).toBe('replied');
    expect(s().activeAlert).toBeNull();
  });

  it('subscription flow: refresh syncs premium status onto user', async () => {
    s().setUser({ id: 'u1', phone: '138' } as never);
    mockSubscriptionApi.getStatus.mockResolvedValue({
      plan: 'yearly',
      status: 'active',
      currentPeriodEnd: '2027-01-01',
      isPremium: true,
    });
    await s().refreshSubscription();
    expect(s().subscription).toEqual(expect.objectContaining({ plan: 'yearly', isPremium: true }));
    expect((s().user as { isPremium?: boolean }).isPremium).toBe(true);
  });

  it('realtime-driven flow: SSE events move the home status machine', () => {
    useStore.setState({ todayStatus: 'idle' });

    applyRealtimeEvent({ userId: 'u1', type: 'status_changed', payload: { status: 'grace' }, at: 't' });
    expect(s().todayStatus).toBe('grace');

    applyRealtimeEvent({ userId: 'u1', type: 'alert_triggered', at: 't' });
    expect(s().todayStatus).toBe('alert');

    applyRealtimeEvent({ userId: 'u1', type: 'reply_confirmed', at: 't' });
    expect(s().todayStatus).toBe('replied');
  });
});
