import type { User, EmergencyContact, Guardian, AlertEvent } from '@/types';

/* ──────────────── Mock User ──────────────── */
export const mockUser: User = {
  id: 'u1',
  phone: '13800138000',
  nickname: '小李',
  address: '北京市朝阳区XX路XX号',
  createdAt: '2026-06-20T10:00:00Z',
  isPremium: false,
};

/* ──────────────── Mock Contacts ──────────────── */
export const mockContacts: EmergencyContact[] = [
  {
    id: 'c1',
    name: '妈妈',
    phone: '138****5678',
    relation: '母亲',
    priority: 1,
    verified: true,
  },
];

/* ──────────────── Mock Guardian ──────────────── */
export const mockGuardians: Guardian[] = [
  {
    id: 'g1',
    wardName: '妈妈',
    wardPhone: '138****5678',
    relation: '母亲',
    status: 'replied',
    lastReplyAt: '今天 19:25',
    streak: 4,
    isBound: true,
    reminderConfig: { startTime: '19:00', endTime: '21:00', gracePeriodMin: 30 },
  },
];

/* ──────────────── Mock Alert ──────────────── */
export const mockAlert: AlertEvent = {
  id: 'a1',
  userId: 'u1',
  triggeredAt: '2026-06-24T23:02:00Z',
  status: 'active',
  lastReplyAt: '2026-06-23T20:15:00Z',
  contactsNotified: ['妈妈'],
  smsRounds: 1,
  timeline: [
    { time: '22:32', action: '系统检测到超时' },
    { time: '22:32', action: '发送关心式提醒给小李' },
    { time: '23:02', action: '小李未回复，触发告警' },
    { time: '23:02', action: '通知联系人（妈妈）', isCurrent: true },
    { time: '等待中', action: '等待确认中...', isCurrent: true },
  ],
};

/* ──────────────── Mock API Responses ──────────────── */
export const mockResponses = {
  'POST /auth/sms-code': {
    success: true,
    expiresIn: 60,
  },

  'POST /auth/login': {
    token: 'mock_jwt_token_abc123',
    user: mockUser,
  },

  'GET /user/profile': mockUser,

  'GET /contacts': mockContacts,

  'GET /reminder/config': {
    startTime: '20:00',
    endTime: '22:00',
    gracePeriodMin: 30,
  },

  'GET /reply/status': {
    status: 'waiting',
  },

  'GET /reply/streak': {
    streak: 12,
  },

  'GET /alert/active': null,

  'GET /guardian': mockGuardians,
};

/* ──────────────── Mock API Delay ──────────────── */
export const mockDelay = (ms: number = 500) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/* ──────────────── Mock API Handler ──────────────── */
export const mockApiHandler = async <T>(
  method: string,
  path: string,
  data?: any,
): Promise<T> => {
  await mockDelay();

  const key = `${method} ${path}`;
  const response = mockResponses[key as keyof typeof mockResponses];

  if (response !== undefined) {
    return response as T;
  }

  throw new Error(`Mock API not found: ${key}`);
};
