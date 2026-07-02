/**
 * api.types 封装方法测试 —— 验证每个 api 包装把正确的 HTTP method + URL + payload
 * 透传给底层 api 客户端（契约正确性）。mock 掉 ./api 单例。
 */
import {
  authApi,
  contactApi,
  replyApi,
  subscriptionApi,
  pauseApi,
} from '../api.types';

jest.mock('../api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
    put: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const mockApi = (jest.requireMock('../api') as { api: Record<string, jest.Mock> }).api;

describe('api.types wrappers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('authApi', () => {
    it('sendCode → POST /auth/send-code', () => {
      authApi.sendCode({ phone: '138' });
      expect(mockApi.post).toHaveBeenCalledWith('/auth/send-code', { phone: '138' });
    });
    it('verifyCode → POST /auth/verify-code', () => {
      authApi.verifyCode({ phone: '138', code: '1234' });
      expect(mockApi.post).toHaveBeenCalledWith('/auth/verify-code', { phone: '138', code: '1234' });
    });
    it('getMe → GET /auth/me', () => {
      authApi.getMe();
      expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('contactApi', () => {
    it('list → GET endpoint', () => {
      contactApi.list();
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get.mock.calls[0][0]).toContain('contact');
    });
    it('create → POST with payload', () => {
      const payload = { name: '妈妈', phone: '138', relation: '家人', priority: 1 } as any;
      contactApi.create(payload);
      expect(mockApi.post).toHaveBeenCalledWith(expect.stringContaining('contact'), payload);
    });
  });

  describe('replyApi', () => {
    it('reply → POST /reply/today', () => {
      replyApi.reply();
      expect(mockApi.post.mock.calls[0][0]).toContain('reply');
    });
    it('getStatus → GET /reply/status', () => {
      replyApi.getStatus();
      expect(mockApi.get.mock.calls[0][0]).toContain('reply');
    });
  });

  describe('subscriptionApi', () => {
    it('getStatus → GET /subscription/status', () => {
      subscriptionApi.getStatus();
      expect(mockApi.get).toHaveBeenCalledWith('/subscription/status');
    });
    it('verify → POST /subscription/verify with payload', () => {
      const data = { transactionId: 't1', plan: 'monthly' } as any;
      subscriptionApi.verify(data);
      expect(mockApi.post).toHaveBeenCalledWith('/subscription/verify', data);
    });
  });

  describe('pauseApi', () => {
    it('pause → POST /pause with days', () => {
      pauseApi.pause({ days: 7 });
      expect(mockApi.post).toHaveBeenCalledWith('/pause', { days: 7 });
    });
    it('resume → POST /pause/resume', () => {
      pauseApi.resume();
      expect(mockApi.post).toHaveBeenCalledWith('/pause/resume');
    });
    it('getStatus → GET /pause/status', () => {
      pauseApi.getStatus();
      expect(mockApi.get).toHaveBeenCalledWith('/pause/status');
    });
  });
});
