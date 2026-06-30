/**
 * 统一前端错误上报。
 *
 * 设计：Sentry 作为可插拔后端——配置了 EXPO_PUBLIC_SENTRY_DSN 才动态加载
 * @sentry/react-native 并启用；否则在 __DEV__ 下打印、生产静默丢弃，
 * 不引入硬依赖（SDK 未安装也能编译运行）。
 *
 * 目的：消灭散落各处的静默 catch——错误至少被集中记录/上报，
 * 千万日活时生产故障才有可观测性，而非被吞掉。
 */

type Extra = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentry: any = null;
let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    // 动态加载，避免对未安装的 SDK 形成编译期硬依赖
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react-native');
    Sentry.init({ dsn, environment: __DEV__ ? 'development' : 'production' });
    sentry = Sentry;
  } catch {
    // SDK 未安装，降级为日志
  }
}

/**
 * 上报一个被捕获的错误。
 * @param error  捕获到的错误
 * @param context 业务上下文（操作名、用户动作等），便于排查
 */
export function reportError(error: unknown, context?: Extra): void {
  ensureInit();
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[reportError]', context?.scope ?? '', error, context ?? '');
  }
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  }
}
