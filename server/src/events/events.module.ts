import { Global, Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

/**
 * 实时事件模块（全局）：其它模块（reminder cron / reply / guardian）注入
 * EventsService 发布事件，SSE 端点消费。
 */
@Global()
@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
