import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User,
  EmergencyContact,
  ReminderConfig,
  ReplyStatus,
  AlertEvent,
  Guardian,
  OnboardingStep,
} from '@/types';

interface AppState {
  /* Auth */
  user: User | null;
  isOnboarded: boolean;
  onboardingStep: OnboardingStep;

  /* Contacts */
  contacts: EmergencyContact[];

  /* Reminder */
  reminder: ReminderConfig;
  todayStatus: ReplyStatus;
  streak: number;

  /* Alert */
  activeAlert: AlertEvent | null;

  /* Guardians (子女端) */
  guardians: Guardian[];

  /* Notification */
  notificationAuthorized: boolean;

  /* Actions */
  setUser: (user: User | null) => void;
  completeOnboarding: () => void;
  setOnboardingStep: (step: OnboardingStep) => void;
  setContacts: (contacts: EmergencyContact[]) => void;
  addContact: (c: EmergencyContact) => void;
  updateContact: (id: string, patch: Partial<EmergencyContact>) => void;
  removeContact: (id: string) => void;
  setReminder: (r: ReminderConfig) => void;
  setTodayStatus: (status: ReplyStatus) => void;
  setStreak: (streak: number) => void;
  reply: () => void;
  undoReply: () => void;
  triggerAlert: (alert: AlertEvent) => void;
  setActiveAlert: (alert: AlertEvent | null) => void;
  resolveAlert: () => void;
  setGuardians: (guardians: Guardian[]) => void;
  setNotificationAuthorized: (v: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
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

      setUser: (user) => set({ user }),
      completeOnboarding: () => set({ isOnboarded: true }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setContacts: (contacts) => set({ contacts }),
      addContact: (c) => set((s) => ({ contacts: [...s.contacts, c] })),
      updateContact: (id, patch) =>
        set((s) => ({
          contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeContact: (id) =>
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      setReminder: (reminder) => set({ reminder }),
      setTodayStatus: (status) => set({ todayStatus: status }),
      setStreak: (streak) => set({ streak }),
      reply: () =>
        set((s) => ({
          todayStatus: 'replied',
          streak: s.streak + 1,
          activeAlert: null,
        })),
      undoReply: () =>
        set((s) => ({
          todayStatus: 'waiting',
          streak: Math.max(0, s.streak - 1),
        })),
      triggerAlert: (alert) => set({ activeAlert: alert, todayStatus: 'alert' }),
      setActiveAlert: (alert) => set({ activeAlert: alert }),
      resolveAlert: () => set({ activeAlert: null, todayStatus: 'replied' }),
      setGuardians: (guardians) => set({ guardians }),
      setNotificationAuthorized: (v) => set({ notificationAuthorized: v }),
    }),
    {
      name: 'today-ok-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
