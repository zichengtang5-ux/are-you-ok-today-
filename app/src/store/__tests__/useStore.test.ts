/**
 * useStore 测试 —— 覆盖所有同步 action 的状态变更 + refreshSubscription 异步分支。
 */
// zustand persist 依赖 AsyncStorage 原生模块，测试环境用官方 mock 替代
import { useStore } from '../useStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/api.types', () => ({
  subscriptionApi: { getStatus: jest.fn() },
}));
jest.mock('@/services/errorReporter', () => ({ reportError: jest.fn() }));

const mockSubscriptionApi = (
  jest.requireMock('@/services/api.types') as { subscriptionApi: { getStatus: jest.Mock } }
).subscriptionApi;
const mockReportError = (
  jest.requireMock('@/services/errorReporter') as { reportError: jest.Mock }
).reportError;

// 初始状态快照，用于每个测试前重置
const INITIAL = {
  user: null,
  isOnboarded: false,
  onboardingStep: 'login' as const,
  contacts: [],
  reminder: { startTime: '20:00', endTime: '22:00', gracePeriodMin: 30 },
  todayStatus: 'idle' as const,
  streak: 0,
  activeAlert: null,
  guardians: [],
  notificationAuthorized: false,
  subscription: null,
};

function reset() {
  useStore.setState(INITIAL);
}

const s = () => useStore.getState();

describe('useStore actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reset();
  });

  describe('auth & onboarding', () => {
    it('setUser sets and clears the user', () => {
      s().setUser({ id: 'u1', phone: '138' } as any);
      expect(s().user).toEqual({ id: 'u1', phone: '138' });
      s().setUser(null);
      expect(s().user).toBeNull();
    });
    it('completeOnboarding flips isOnboarded', () => {
      expect(s().isOnboarded).toBe(false);
      s().completeOnboarding();
      expect(s().isOnboarded).toBe(true);
    });
    it('setOnboardingStep updates step', () => {
      s().setOnboardingStep('complete' as any);
      expect(s().onboardingStep).toBe('complete');
    });
  });

  describe('contacts', () => {
    const c1 = { id: 'c1', name: '妈妈', phone: '138', relation: '家人', priority: 1, verified: true } as any;
    const c2 = { id: 'c2', name: '爸爸', phone: '139', relation: '家人', priority: 2, verified: false } as any;

    it('setContacts replaces the list', () => {
      s().setContacts([c1, c2]);
      expect(s().contacts).toHaveLength(2);
    });
    it('addContact appends', () => {
      s().addContact(c1);
      s().addContact(c2);
      expect(s().contacts.map((c) => c.id)).toEqual(['c1', 'c2']);
    });
    it('updateContact patches matching id only', () => {
      s().setContacts([c1, c2]);
      s().updateContact('c1', { verified: false, name: '妈' });
      expect(s().contacts.find((c) => c.id === 'c1')).toEqual(
        expect.objectContaining({ verified: false, name: '妈' }),
      );
      expect(s().contacts.find((c) => c.id === 'c2')?.name).toBe('爸爸');
    });
    it('removeContact filters by id', () => {
      s().setContacts([c1, c2]);
      s().removeContact('c1');
      expect(s().contacts.map((c) => c.id)).toEqual(['c2']);
    });
  });

  describe('reminder & today status', () => {
    it('setReminder replaces config', () => {
      s().setReminder({ startTime: '19:00', endTime: '21:00', gracePeriodMin: 15 });
      expect(s().reminder.startTime).toBe('19:00');
    });
    it('setTodayStatus / setStreak', () => {
      s().setTodayStatus('waiting');
      expect(s().todayStatus).toBe('waiting');
      s().setStreak(5);
      expect(s().streak).toBe(5);
    });
  });

  describe('reply / undoReply (streak edges)', () => {
    it('reply sets replied, increments streak, clears alert', () => {
      useStore.setState({ streak: 3, activeAlert: { id: 'a1' } as any });
      s().reply();
      expect(s().todayStatus).toBe('replied');
      expect(s().streak).toBe(4);
      expect(s().activeAlert).toBeNull();
    });
    it('undoReply sets waiting, decrements streak (floors at 0)', () => {
      useStore.setState({ streak: 2, todayStatus: 'replied' });
      s().undoReply();
      expect(s().todayStatus).toBe('waiting');
      expect(s().streak).toBe(1);
    });
    it('undoReply never goes below 0', () => {
      useStore.setState({ streak: 0 });
      s().undoReply();
      expect(s().streak).toBe(0);
    });
  });

  describe('alert lifecycle', () => {
    const alert = { id: 'a1', status: 'active' } as any;
    it('triggerAlert sets alert + alert status', () => {
      s().triggerAlert(alert);
      expect(s().activeAlert).toEqual(alert);
      expect(s().todayStatus).toBe('alert');
    });
    it('setActiveAlert sets/clears', () => {
      s().setActiveAlert(alert);
      expect(s().activeAlert).toEqual(alert);
      s().setActiveAlert(null);
      expect(s().activeAlert).toBeNull();
    });
    it('resolveAlert clears alert and sets replied', () => {
      s().triggerAlert(alert);
      s().resolveAlert();
      expect(s().activeAlert).toBeNull();
      expect(s().todayStatus).toBe('replied');
    });
  });

  describe('guardians / notification / subscription setters', () => {
    it('setGuardians', () => {
      s().setGuardians([{ id: 'g1' } as any]);
      expect(s().guardians).toHaveLength(1);
    });
    it('setNotificationAuthorized', () => {
      s().setNotificationAuthorized(true);
      expect(s().notificationAuthorized).toBe(true);
    });
    it('setSubscription', () => {
      s().setSubscription({ plan: 'monthly', status: 'active', isPremium: true } as any);
      expect(s().subscription?.isPremium).toBe(true);
    });
  });

  describe('refreshSubscription (async)', () => {
    it('updates subscription and syncs user.isPremium on success', async () => {
      useStore.setState({ user: { id: 'u1', phone: '138' } as any });
      mockSubscriptionApi.getStatus.mockResolvedValue({
        plan: 'yearly',
        status: 'active',
        currentPeriodEnd: '2027-01-01',
        isPremium: true,
      });
      await s().refreshSubscription();
      expect(s().subscription).toEqual(
        expect.objectContaining({ plan: 'yearly', isPremium: true }),
      );
      expect((s().user as any).isPremium).toBe(true);
      expect(mockReportError).not.toHaveBeenCalled();
    });

    it('defaults plan to free when null', async () => {
      mockSubscriptionApi.getStatus.mockResolvedValue({
        plan: null,
        status: 'none',
        currentPeriodEnd: null,
        isPremium: false,
      });
      await s().refreshSubscription();
      expect(s().subscription?.plan).toBe('free');
    });

    it('reports error and does not throw on failure', async () => {
      mockSubscriptionApi.getStatus.mockRejectedValue(new Error('500'));
      await expect(s().refreshSubscription()).resolves.toBeUndefined();
      expect(mockReportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ scope: 'refreshSubscription' }),
      );
    });
  });
});
