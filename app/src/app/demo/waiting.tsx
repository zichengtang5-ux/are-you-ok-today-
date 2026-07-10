import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useStore } from '@/store/useStore';

/** Development-only entry point for manually testing the core check-in interaction. */
export default function WaitingCheckInDemo() {
  const router = useRouter();
  const startCheckInDemo = useStore((state) => state.startCheckInDemo);

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
      return;
    }
    startCheckInDemo();
    router.replace('/(tabs)');
  }, [router, startCheckInDemo]);

  return null;
}
