import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

interface DeepLinkRoute {
  path: Href;
  params?: Record<string, string>;
}

export function parseDeepLink(url: string): DeepLinkRoute | null {
  const parsed = Linking.parse(url);

  if (!parsed.hostname && !parsed.path) return null;

  const path = parsed.path ?? '';
  const segments = path.split('/').filter(Boolean);
  const queryParams = parsed.queryParams ?? {};

  if (segments[0] === 'alert' && segments[1]) {
    return {
      path: '/alert/contact' as Href,
      params: { alertId: segments[1], ...queryParams as Record<string, string> },
    };
  }

  if (segments[0] === 'reply') {
    return { path: '/(tabs)' as Href };
  }

  if (segments[0] === 'invite' && segments[1]) {
    return {
      path: '/(tabs)' as Href,
      params: { inviteCode: segments[1] },
    };
  }

  if (segments[0] === 'settings') {
    return { path: '/(tabs)/settings' as Href };
  }

  return null;
}

export function navigateDeepLink(url: string, router: Router): boolean {
  const route = parseDeepLink(url);
  if (!route) return false;

  router.push(route.path);
  return true;
}

export function getInitialURL(): Promise<string | null> {
  return Linking.getInitialURL();
}

export function addDeepLinkListener(callback: (url: string) => void): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    callback(event.url);
  });
  return () => subscription.remove();
}
