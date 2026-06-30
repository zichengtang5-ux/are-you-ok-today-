import { reportError } from '../errorReporter';

/**
 * errorReporter 是消灭静默 catch 的统一上报入口。
 * 测试环境无 EXPO_PUBLIC_SENTRY_DSN，应降级为日志、绝不抛错。
 */
describe('reportError', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
  });

  it('does not throw when given an Error (no DSN configured)', () => {
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });

  it('does not throw when given a non-Error value', () => {
    expect(() => reportError('string error')).not.toThrow();
    expect(() => reportError({ weird: true })).not.toThrow();
    expect(() => reportError(undefined)).not.toThrow();
  });

  it('logs the error with scope context in __DEV__', () => {
    const warnSpy = jest.spyOn(console, 'warn');
    reportError(new Error('boom'), { scope: 'unit-test' });
    expect(warnSpy).toHaveBeenCalled();
    // 第一个参数是标签，确认 scope 被传入日志
    const callArgs = warnSpy.mock.calls[0];
    expect(callArgs).toEqual(expect.arrayContaining(['[reportError]']));
  });

  it('accepts arbitrary context without throwing', () => {
    expect(() =>
      reportError(new Error('x'), { scope: 'a', userId: '123', extra: { nested: 1 } }),
    ).not.toThrow();
  });
});
