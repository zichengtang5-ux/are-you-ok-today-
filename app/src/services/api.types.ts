import { api } from './api';
import type { User } from '@/types';

/* ──────────────── Auth ──────────────── */
export interface SendCodeRequest {
  phone: string;
}

export interface SendCodeResponse {
  message: string;
  cooldownSeconds: number;
  mockCode?: string; // 仅开发环境返回
}

export interface VerifyCodeRequest {
  phone: string;
  code: string;
}

export interface VerifyCodeResponse {
  accessToken: string;
  refreshToken: string;
  user: User & {
    isOnboarded: boolean;
    onboardingStep: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  sendCode: (data: SendCodeRequest) =>
    api.post<SendCodeResponse>('/auth/send-code', data),

  verifyCode: (data: VerifyCodeRequest) =>
    api.post<VerifyCodeResponse>('/auth/verify-code', data),

  refresh: (data: RefreshTokenRequest) =>
    api.post<RefreshTokenResponse>('/auth/refresh', data),

  getMe: () =>
    api.get<User & {
      isOnboarded: boolean;
      onboardingStep: string;
      contacts: any[];
      reminderConfig: any;
      guardStatus: any;
      subscription: any;
      guardianOf: any[];
      wardOf: any[];
    }>('/auth/me'),
};

/* ──────────────── User ──────────────── */
export interface UpdateProfileRequest {
  nickname?: string;
  address?: string;
  notificationAuth?: boolean;
}

export interface UpdateOnboardingRequest {
  step: string;
  isOnboarded: boolean;
}

export const userApi = {
  getProfile: () =>
    api.get<User>('/user/profile'),

  updateProfile: (data: UpdateProfileRequest) =>
    api.patch<User>('/user/profile', data),

  updateOnboarding: (data: UpdateOnboardingRequest) =>
    api.patch('/user/onboarding', data),
};

/* ──────────────── Contacts ──────────────── */
export interface CreateContactRequest {
  name: string;
  phone: string;
  relation: string;
}

export interface ContactResponse {
  id: string;
  name: string;
  phone: string;
  relation: string;
  priority: number;
  verified: boolean;
}

export const contactApi = {
  list: () =>
    api.get<ContactResponse[]>('/contacts'),

  create: (data: CreateContactRequest) =>
    api.post<ContactResponse>('/contacts', data),

  update: (id: string, data: Partial<CreateContactRequest>) =>
    api.patch<ContactResponse>(`/contacts/${id}`, data),

  delete: (id: string) =>
    api.delete(`/contacts/${id}`),

  sendVerifyCode: (id: string) =>
    api.post<{ message: string; cooldownSeconds: number; mockCode?: string }>(`/contacts/${id}/send-code`),

  verify: (id: string, code: string) =>
    api.post<{ message: string; contact: ContactResponse }>(`/contacts/${id}/verify`, { code }),

  reorder: (ids: string[]) =>
    api.put('/contacts/reorder', { ids }),
};

/* ──────────────── Reminder ──────────────── */
export interface ReminderConfigResponse {
  startTime: string;
  endTime: string;
  gracePeriodMin: number;
}

export const reminderApi = {
  getConfig: () =>
    api.get<ReminderConfigResponse>('/reminder/config'),

  updateConfig: (data: Partial<ReminderConfigResponse>) =>
    api.patch<ReminderConfigResponse>('/reminder/config', data),
};

/* ──────────────── Reply ──────────────── */
export type ReplyStatus = 'idle' | 'waiting' | 'replied' | 'grace' | 'alert' | 'paused';

export interface MonthlyStats {
  repliedDays: number;
  totalDays: number;
  daysInMonth: number;
  display: string;
}

export interface ReplyStatusResponse {
  status: ReplyStatus;
  lastReplyAt: string | null;
  todayReplied: boolean;
  todayRepliedAt: string | null;
  reminderConfig: {
    startTime: string;
    endTime: string;
    gracePeriodMin: number;
    timezone: string;
  };
  monthlyStats: MonthlyStats;
}

export interface ReplyTodayResponse {
  message: string;
  repliedAt: string;
  guardStatus: string;
  alertResolved: boolean;
}

export interface UndoReplyResponse {
  message: string;
  guardStatus: string;
}

export const replyApi = {
  getStatus: () =>
    api.get<ReplyStatusResponse>('/reply/status'),

  reply: () =>
    api.post<ReplyTodayResponse>('/reply/today'),

  undoReply: () =>
    api.delete<UndoReplyResponse>('/reply/today'),

  getStreak: () =>
    api.get<{ streak: number }>('/reply/streak'),
};

/* ──────────────── Alert ──────────────── */
export type AlertStatus = 'active' | 'confirmed' | 'help_needed' | 'resolved';

export interface AlertTimelineItem {
  time: string;
  action: string;
  isCurrent?: boolean;
}

export interface AlertResponse {
  id: string;
  userId: string;
  triggeredAt: string;
  status: AlertStatus;
  lastReplyAt?: string;
  contactsNotified: string[];
  smsRounds: number;
  timeline: AlertTimelineItem[];
}

export const alertApi = {
  getActive: () =>
    api.get<AlertResponse | null>('/alert/active'),

  confirm: (alertId: string) =>
    api.post<AlertResponse>(`/alert/${alertId}/confirm`),

  needHelp: (alertId: string) =>
    api.post<AlertResponse>(`/alert/${alertId}/help`),
};

/* ──────────────── Guardian ──────────────── */
export interface CreateGuardianRequest {
  wardName: string;
  wardPhone: string;
  relation: string;
  reminderStartTime?: string;
  reminderEndTime?: string;
}

export interface GuardianResponse {
  id: string;
  wardName: string;
  wardPhone: string;
  relation: string;
  status: ReplyStatus;
  lastReplyAt?: string;
  streak: number;
  isBound: boolean;
  reminderConfig: ReminderConfigResponse;
}

export const guardianApi = {
  create: (data: CreateGuardianRequest) =>
    api.post<GuardianResponse>('/guardian', data),

  list: () =>
    api.get<GuardianResponse[]>('/guardian'),

  getDashboard: (guardianId: string) =>
    api.get<any>(`/guardian/${guardianId}/dashboard`),

  proxyConfirm: (guardianId: string) =>
    api.post<GuardianResponse>(`/guardian/${guardianId}/proxy-confirm`),

  generateInvite: (guardianId: string) =>
    api.post<{ inviteUrl: string }>(`/guardian/${guardianId}/invite`),
};
