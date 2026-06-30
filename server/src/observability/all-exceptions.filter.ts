import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ObservabilityService } from './observability.module';

/**
 * 全局异常过滤器：捕获所有未被业务处理的异常，统一上报到 Observability（Sentry/日志），
 * 并返回规范化的错误响应。避免异常被静默吞掉、生产故障无从追踪。
 *
 * HttpException（业务预期错误，如 400/403/409）只记录、不上报 Sentry（避免噪声）；
 * 非 HttpException（未预期的 500）才上报，便于聚焦真正的 bug。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly observability: ObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttp || status >= 500) {
      // 仅未预期错误 / 5xx 上报，业务 4xx 不污染告警
      this.observability.captureException(exception, {
        path: request.url,
        method: request.method,
        statusCode: status,
      });
    }

    const body = isHttp
      ? (exception.getResponse() as object)
      : { statusCode: status, message: '服务器内部错误' };

    response.status(status).json(body);
  }
}
