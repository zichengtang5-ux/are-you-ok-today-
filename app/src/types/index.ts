/* ──────────────── User ──────────────── */
export interface User {
  id: string;
  phone: string;
  nickname: string;
  address?: string;
  createdAt: string;
  isPremium: boolean;
  trialEndsAt?: string;
}

/* ──────────────── Contact ──────────────── */
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  priority: number;
  verified: boolean;
}

/* ──────────────── Reminder ──────────────── */
export interface ReminderConfig {
  startTime: string; // "20:00"
  endTime: string;   // "22:00"
  gracePeriodMin: number; // 30
  timezone?: string; // IANA 时区，如 "Asia/Shanghai"
}

export type ReplyStatus =
  | 'idle'       // 非提醒时段
  | 'waiting'    // 等待回复
  | 'replied'    // 已回复
  | 'grace'      // 宽限期
  | 'alert'      // 告警中
  | 'paused';    // 已暂停

/* ──────────────── Alert ──────────────── */
export type AlertStatus = 'active' | 'confirmed' | 'help_needed' | 'resolved';

export interface AlertContactNotified {
  id: string;
  name: string;
  phone: string;
}

export interface AlertEvent {
  id: string;
  triggeredAt: string;
  status: AlertStatus;
  lastReplyAt?: string;
  contactsNotified: AlertContactNotified[];
  smsRounds?: number;
  timeline: AlertTimelineItem[];
}

export interface AlertTimelineItem {
  time: string;
  action: string;
  isCurrent?: boolean;
}

/* ──────────────── Guardian (子女端) ──────────────── */
export interface Guardian {
  id: string;
  wardName: string;   // 被守护者姓名
  wardPhone: string;
  relation: string;
  status: ReplyStatus;
  lastReplyAt?: string;
  streak: number;
  reminderConfig: ReminderConfig;
  isBound: boolean;
}

/* ──────────────── Subscription ──────────────── */
export type PlanType = 'free' | 'monthly' | 'yearly';

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trial'
  | 'expired'
  | 'cancelled';

export interface Subscription {
  plan: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  originalTransactionId?: string;
  isTrial?: boolean;
  isPremium: boolean;
}

/* ──────────────── Onboarding step ──────────────── */
export type OnboardingStep =
  | 'login'
  | 'agreement'
  | 'basic-info'
  | 'contact-setup'
  | 'reminder-time'
  | 'notification-auth'
  | 'complete';
