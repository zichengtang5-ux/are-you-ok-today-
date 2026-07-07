// mock expo-linking.parse —— 在测试环境中 expo-linking 依赖 Constants.hostUri。
// 模拟其对自定义 scheme 的契约：todayok://alert/abc → path='alert/abc'（host 并入 path）。
import { parseDeepLink } from '../deepLink';

jest.mock('expo-linking', () => ({
  parse: (url: string) => {
    const withoutScheme = url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const [pathAndHost, query = ''] = withoutScheme.split('?');
    const path = pathAndHost.replace(/\/$/, '') || null;
    const queryParams: Record<string, string> = {};
    if (query) {
      for (const pair of query.split('&')) {
        const [k, v] = pair.split('=');
        if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      }
    }
    return { hostname: null, path, queryParams };
  },
}));

/**
 * 深链解析是守护链路的关键入口：从短信/推送点开 todayok://alert/:id 必须
 * 正确路由到告警处理页。此前前端零测试，这是测试基线的第一块。
 */
describe('parseDeepLink', () => {
  it('routes alert links to the contact handling page with alertId', () => {
    const route = parseDeepLink('todayok://alert/abc123');
    expect(route).toEqual({
      path: '/alert/contact',
      params: expect.objectContaining({ alertId: 'abc123' }),
    });
  });

  it('routes reply links to the home tabs', () => {
    expect(parseDeepLink('todayok://reply')).toEqual({ path: '/(tabs)' });
  });

  it('routes plain subscription links', () => {
    expect(parseDeepLink('todayok://subscription')).toEqual({ path: '/subscription' });
  });

  it('returns null for unknown / empty links', () => {
    expect(parseDeepLink('todayok://')).toBeNull();
    expect(parseDeepLink('todayok://unknown/thing')).toBeNull();
  });

  it('does not crash on alert link missing id', () => {
    // alert 无 id → 不匹配 alert 规则，返回 null（不应抛错）
    expect(parseDeepLink('todayok://alert')).toBeNull();
  });
});
