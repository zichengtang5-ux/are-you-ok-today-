import { Controller, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { EventsService, UserEvent } from './events.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('实时事件')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /**
   * SSE 实时事件流。客户端建立长连接后，守护状态变化 / 告警触发 / 回复确认
   * 会被实时推送，替代 30 秒轮询。只推送当前登录用户自己的事件。
   */
  @Sse('stream')
  @ApiBearerAuth()
  @ApiOperation({ summary: '订阅实时事件流（SSE）' })
  stream(@CurrentUser('id') userId: string): Observable<{ data: UserEvent }> {
    return this.events.subscribe(userId);
  }
}
