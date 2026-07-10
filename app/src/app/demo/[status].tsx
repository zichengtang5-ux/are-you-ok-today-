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

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
      return;
    }

    const nextStatus = DEMO_STATUSES.includes(status as ReplyStatus) ? status as ReplyStatus : 'waiting';
    startCheckInDemo();
    setTodayStatus(nextStatus);
    setActiveAlert(nextStatus === 'alert' ? {
      id: 'demo-alert',
      triggeredAt: new Date().toISOString(),
      status: 'active',
      contactsNotified: [],
      timeline: [],
    } : null);
    router.replace('/(tabs)');
  }, [router, setActiveAlert, setTodayStatus, startCheckInDemo, status]);

  return null;
}
