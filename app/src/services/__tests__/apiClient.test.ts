/**
 * ApiClient 拦截器测试 —— 最关键的网络层逻辑：
 *  - 请求拦截器注入 Bearer token
 *  - 响应拦截器在 401 时刷新 token 并重试
 *  - 刷新失败时清除 token
 *
 * 策略：mock axios，使 axios.create 返回一个 stub client，捕获注册到
 * client.interceptors 上的 fulfilled/rejected 函数后直接调用断言。
 * mock 工厂内部创建所有状态，外部通过 requireMock 获取（规避 hoist/TDZ）。
 */
// 触发 ApiClient 构造（注册拦截器）
import '../api';

jest.mock('../watchSync', () => ({
  clearWatchContext: jest.fn(() => Promise.resolve()),
}));

jest.mock('axios', () => {
  const requestInterceptors: ((c: unknown) => unknown)[] = [];
  const responseHandlers: { ok: (r: unknown) => unknown; err: (e: unknown) => unknown }[] = [];
  const stubClient: jest.Mock & { interceptors?: unknown; get?: jest.Mock; post?: jest.Mock } =
    jest.fn((config: unknown) => Promise.resolve({ data: 'retried', config }));
  stubClient.interceptors = {
    request: { use: (fn: (c: unknown) => unknown) => requestInterceptors.push(fn) },
    response: {
      use: (ok: (r: unknown) => unknown, err: (e: unknown) => unknown) =>
        responseHandlers.push({ ok, err }),
    },
  };
  stubClient.get = jest.fn();
  stubClient.post = jest.fn();
  const post = jest.fn();
  return {
    __esModule: true,
    default: { create: () => stubClient, post },
    // 暴露内部状态给测试
    __test: { requestInterceptors, responseHandlers, stubClient, post },
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const storage: Record<string, string | null> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(storage[k] ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        storage[k] = v;
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        keys.forEach((k) => delete storage[k]);
        return Promise.resolve();
      }),
    },
    __storage: storage,
  };
});

const axiosMock = jest.requireMock('axios') as {
  __test: {
    requestInterceptors: ((c: unknown) => unknown)[];
    responseHandlers: { err: (e: unknown) => unknown }[];
    post: jest.Mock;
  };
};
const storageMock = (jest.requireMock('@react-native-async-storage/async-storage') as {
  __storage: Record<string, string | null>;
}).__storage;
const axiosPost = axiosMock.__test.post;

const getRequestInterceptor = () => axiosMock.__test.requestInterceptors[0];
const getResponseErrHandler = () => axiosMock.__test.responseHandlers[0].err;

describe('ApiClient interceptors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  });

  describe('request interceptor', () => {
    it('injects Bearer token when access_token present', async () => {
      storageMock['access_token'] = 'abc';
      const cfg: any = await getRequestInterceptor()({ headers: {} });
      expect(cfg.headers.Authorization).toBe('Bearer abc');
    });
    it('leaves headers untouched when no token', async () => {
      const cfg: any = await getRequestInterceptor()({ headers: {} });
      expect(cfg.headers.Authorization).toBeUndefined();
    });
  });

  describe('response error handler (401 refresh)', () => {
    it('refreshes token and retries the original request on 401', async () => {
      storageMock['refresh_token'] = 'refresh-1';
      axiosPost.mockResolvedValue({
        data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
      });
      const error = {
        response: { status: 401 },
        config: { headers: {}, url: '/protected' },
      };
      const result: any = await getResponseErrHandler()(error);
      expect(result).toEqual(expect.objectContaining({ data: 'retried' }));
      expect(storageMock['access_token']).toBe('new-access');
      expect(storageMock['refresh_token']).toBe('new-refresh');
    });

    it('clears tokens when refresh fails (no refresh_token)', async () => {
      storageMock['access_token'] = 'stale';
      const error = { response: { status: 401 }, config: { headers: {}, url: '/x' } };
      await expect(getResponseErrHandler()(error)).rejects.toBeDefined();
      expect(storageMock['access_token']).toBeUndefined();
    });

    it('does not retry twice (respects _retry flag)', async () => {
      const error = {
        response: { status: 401 },
        config: { headers: {}, url: '/x', _retry: true },
      };
      await expect(getResponseErrHandler()(error)).rejects.toBe(error);
    });

    it('passes through non-401 errors unchanged', async () => {
      const error = { response: { status: 500 }, config: { headers: {} } };
      await expect(getResponseErrHandler()(error)).rejects.toBe(error);
    });
  });
});
