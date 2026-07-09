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

/* ──────────────── Guardian Relation (from /auth/me) ──────────────── */
export interface GuardianRelationResponse {
  id: string;
  guardianId: string;
  wardId: string;
  relation: string;
  inviteCode: string | null;
  isBound: boolean;
  createdAt: string;
  updatedAt: string;
  ward: {
    id: string;
    phone: string;
    nickname: string | null;
  };
}

export interface WardOfResponse {
  id: string;
  guardianId: string;
  wardId: string;
  relation: string;
  inviteCode: string | null;
  isBound: boolean;
  createdAt: string;
  updatedAt: string;
  guardian: {
    id: string;
    phone: string;
    nickname: string | null;
  };
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
      contacts: ContactResponse[];
      reminderConfig: ReminderConfigResponse;
      guardStatus: { status: ReplyStatus };
      subscription: SubscriptionRecord | null;
      guardianOf: GuardianRelationResponse[];
      wardOf: WardOfResponse[];
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

  deleteAccount: (confirmation: string) =>
    api.delete<{ message: string }>('/user/account', { data: { confirmation } }),
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
  guardStatus: 'waiting' | 'grace';
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

/* ──────────────── Device (S3) ──────────────── */
export interface RegisterDeviceRequest {
  token: string;
  platform: 'ios' | 'android';
}

export interface RegisterDeviceResponse {
  message: string;
}

export const deviceApi = {
  register: (data: RegisterDeviceRequest) =>
    api.post<RegisterDeviceResponse>('/device/register', data),
};

/* ──────────────── Alert (S4) ──────────────── */
export type AlertStatus = 'active' | 'confirmed' | 'help_needed' | 'resolved';

export interface AlertTimelineItem {
  time: string;
  action: string;
  isCurrent?: boolean;
}

export interface AlertContactNotified {
  id: string;
  name: string;
  phone: string;
}

export interface ActiveAlertResponse {
  id: string;
  triggeredAt: string;
  lastReplyAt: string | null;
  contactsNotified: AlertContactNotified[];
  timeline: AlertTimelineItem[];
}

export interface AlertConfirmResponse {
  message: string;
  alert: {
    id: string;
    status: 'confirmed';
    resolvedAt: string;
  };
}

export interface SuggestedAction {
  type: 'call_user' | 'call_120' | 'call_contact';
  label: string;
  phone?: string;
  address?: string;
  contacts?: AlertContactNotified[];
}

export interface AlertHelpResponse {
  message: string;
  alert: {
    id: string;
    status: 'help_needed';
  };
  suggestedActions: SuggestedAction[];
}

export const alertApi = {
  getActive: () =>
    api.get<ActiveAlertResponse | null>('/alert/active'),

  confirm: (alertId: string, contactId: string) =>
    api.post<AlertConfirmResponse>(`/alert/${alertId}/confirm`, { contactId }),

  needHelp: (alertId: string, contactId: string) =>
    api.post<AlertHelpResponse>(`/alert/${alertId}/help`, { contactId }),
};

/* ──────────────── Help (S5) ──────────────── */
export interface EmergencyHelpRequest {
  latitude?: number;
  longitude?: number;
  addressText?: string;
}

export interface EmergencyHelpResponse {
  id: string;
  createdAt: string;
  address: string;
  contactsNotified: AlertContactNotified[];
  message: string;
}

export interface HelpAddressResponse {
  address: string;
  source: 'gps' | 'user_preset';
}

export const helpApi = {
  emergency: (data: EmergencyHelpRequest) =>
    api.post<EmergencyHelpResponse>('/help/emergency', data),

  getAddress: () =>
    api.get<HelpAddressResponse>('/help/address'),
};

/* ──────────────── Guardian (S5) ──────────────── */
export interface CreateGuardianRequest {
  wardName: string;
  wardPhone: string;
  relation: string;
}

export interface CreateGuardianResponse {
  id: string;
  inviteCode: string;
  inviteLink: string;
  isBound: boolean;
  wardName: string;
  wardPhone: string;
}

export interface AcceptInviteResponse {
  message: string;
  guardian: {
    id: string;
    guardianName: string;
  };
}

export interface GuardianWardResponse {
  id: string;
  wardName: string;
  wardPhone: string;
  relation: string;
  isBound: boolean;
  status: ReplyStatus;
  lastReplyAt?: string;
  reminderConfig: ReminderConfigResponse;
}

export interface WardDashboardResponse {
  wardName: string;
  status: ReplyStatus;
  lastReplyAt: string;
  recentDays: { date: string; replied: boolean }[] | null;
  monthlyStats: {
    repliedDays: number;
    totalDays: number;
    display: string;
  } | null;
  history: { date: string; event: string }[] | null;
}

export interface ProxyReplyResponse {
  message: string;
  guardStatus: string;
}

export const guardianApi = {
  create: (data: CreateGuardianRequest) =>
    api.post<CreateGuardianResponse>('/guardian/create', data),

  acceptInvite: (inviteCode: string) =>
    api.post<AcceptInviteResponse>('/guardian/accept-invite', { inviteCode }),

  listWards: () =>
    api.get<GuardianWardResponse[]>('/guardian/wards'),

  getDashboard: (wardId: string) =>
    api.get<WardDashboardResponse>(`/guardian/wards/${wardId}/dashboard`),

  proxyReply: (wardId: string) =>
    api.post<ProxyReplyResponse>(`/guardian/wards/${wardId}/proxy-reply`),
};

/* ──────────────── Subscription (S6) ──────────────── */
export type SubscriptionPlan = 'monthly' | 'yearly';
export type SubscriptionProvider = 'apple';
export type SubscriptionStatusValue = 'active' | 'trial' | 'expired' | 'cancelled' | 'none';

export interface SubscriptionVerifyRequest {
  transactionId: string;
  plan: SubscriptionPlan;
  provider?: SubscriptionProvider;
}

export interface SubscriptionRecord {
  plan: SubscriptionPlan;
  status: SubscriptionStatusValue;
  currentPeriodEnd: string;
  originalTransactionId?: string;
  isTrial?: boolean;
}

export interface SubscriptionResponse {
  subscription: SubscriptionRecord;
}

export interface ProxySubscribeRequest {
  wardId: string;
  transactionId: string;
  plan: SubscriptionPlan;
  provider?: SubscriptionProvider;
}

export interface ProxySubscribeResponse {
  message: string;
  wardName: string;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatusValue;
    currentPeriodEnd: string;
  };
}

export interface SubscriptionStatusResponse {
  plan: SubscriptionPlan | null;
  status: SubscriptionStatusValue;
  currentPeriodEnd: string | null;
  isPremium: boolean;
}

export const subscriptionApi = {
  verify: (data: SubscriptionVerifyRequest) =>
    api.post<SubscriptionResponse>('/subscription/verify', data),

  proxySubscribe: (data: ProxySubscribeRequest) =>
    api.post<ProxySubscribeResponse>('/subscription/proxy-subscribe', data),

  getStatus: () =>
    api.get<SubscriptionStatusResponse>('/subscription/status'),
};

/* ──────────────── Pause (S7) ──────────────── */
export interface PauseRequest {
  days: number;
  reason?: string;
}

export interface PauseResponse {
  message: string;
  pauseEndAt: string;
  days: number;
}

export interface PauseStatusResponse {
  isPaused: boolean;
  pauseEndAt?: string;
  daysRemaining?: number;
  reason?: string;
}

export interface ResumeResponse {
  message: string;
  guardStatus: string;
}

export const pauseApi = {
  pause: (data: PauseRequest) =>
    api.post<PauseResponse>('/pause', data),

  resume: () =>
    api.post<ResumeResponse>('/pause/resume'),

  getStatus: () =>
    api.get<PauseStatusResponse>('/pause/status'),
};
