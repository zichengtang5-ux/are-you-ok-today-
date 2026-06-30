import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 统一错误上报与可观测性入口。
 *
 * 设计：Sentry 作为可插拔后端——配置了 SENTRY_DSN 才动态加载 @sentry/node 并启用；
 * 否则降级为结构化日志，不引入硬依赖（@sentry/node 未安装也能编译运行）。
 * 这样代码立即可用，上线时安装 SDK + 配置 DSN 即可开启。
 */
@Injectable()
export class ObservabilityService implements OnModuleInit {
  private readonly logger = new Logger('Observability');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sentry: any = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const dsn = this.config.get<string>('SENTRY_DSN');
    if (!dsn) {
      this.logger.log('SENTRY_DSN 未配置，错误上报降级为结构化日志');
      return;
    }
    try {
      // 动态加载，避免对未安装的 SDK 形成编译期硬依赖
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/node');
      Sentry.init({
        dsn,
        environment: this.config.get<string>('NODE_ENV', 'development'),
        tracesSampleRate: 0.1,
      });
      this.sentry = Sentry;
      this.logger.log('Sentry 已启用');
    } catch (e) {
      this.logger.warn(`Sentry DSN 已配置但 @sentry/node 未安装，降级为日志: ${e}`);
    }
  }

  /** 上报异常。无论 Sentry 是否启用，都会结构化记录日志。 */
  captureException(error: unknown, context?: Record<string, unknown>): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(
      JSON.stringify({ level: 'error', message, stack, ...context }),
    );
    if (this.sentry) {
      this.sentry.captureException(error, context ? { extra: context } : undefined);
    }
  }

  /** 记录关键业务指标（告警触发量、通知成功率、cron 耗时等），结构化便于日志系统聚合。 */
  metric(name: string, value: number, tags?: Record<string, string>): void {
    this.logger.log(JSON.stringify({ metric: name, value, ...tags }));
  }
}

@Global()
@Module({
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
