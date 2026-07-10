import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/store/useStore';
import type { ReplyStatus } from '@/types';

const DEMO_STATUSES: ReplyStatus[] = ['idle', 'waiting', 'replied', 'grace', 'alert', 'paused'];

/** Development-only entry point for previewing each home-screen status. */
export default function HomeStatusDemo() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const startCheckInDemo = useStore((state) => state.startCheckInDemo);
  const setTodayStatus = useStore((state) => state.setTodayStatus);
  const setActiveAlert = useStore((state) => state.setActiveAlert);
  const setReminder = useStore((state) => state.setReminder);

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
      return;
    }

    const nextStatus = DEMO_STATUSES.includes(status as ReplyStatus) ? status as ReplyStatus : 'waiting';
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 62 * 60 * 1000);
    const formatTime = (time: Date) => `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    startCheckInDemo();
    setReminder(nextStatus === 'grace'
      ? { startTime: formatTime(oneHourAgo), endTime: formatTime(twoMinutesAgo), gracePeriodMin: 30 }
      : { startTime: '20:00', endTime: '23:00', gracePeriodMin: 30 });
    setTodayStatus(nextStatus);
    setActiveAlert(nextStatus === 'alert' ? {
      id: 'demo-alert',
      triggeredAt: new Date().toISOString(),
      status: 'active',
      contactsNotified: [],
      timeline: [],
    } : null);
    router.replace('/(tabs)');
  }, [router, setActiveAlert, setReminder, setTodayStatus, startCheckInDemo, status]);

  return null;
}
