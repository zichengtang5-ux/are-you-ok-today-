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
}

export type ReplyStatus =
  | 'idle'       // 非提醒时段
  | 'waiting'    // 等待回复
  | 'replied'    // 已回复
  | 'grace'      // 宽限期
  | 'alert'      // 告警中
  | 'paused';    // 已暂停

export interface DailyRecord {
  date: string;
  status: ReplyStatus;
  repliedAt?: string;
}

/* ──────────────── Alert ──────────────── */
export type AlertStatus = 'active' | 'confirmed' | 'help_needed' | 'resolved';

export interface AlertEvent {
  id: string;
  userId: string;
  triggeredAt: string;
  status: AlertStatus;
  lastReplyAt?: string;
  contactsNotified: string[];
  smsRounds: number;
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

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: string;
  period: string;
  features: { label: string; included: boolean }[];
  recommended?: boolean;
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

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'agreement',
  'basic-info',
  'contact-setup',
  'reminder-time',
  'notification-auth',
];
