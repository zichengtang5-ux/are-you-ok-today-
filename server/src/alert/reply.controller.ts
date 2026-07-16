import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReplyService } from './reply.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('每日回复')
@ApiBearerAuth()
@Controller('reply')
export class ReplyController {
  constructor(private readonly replyService: ReplyService) {}

  @Post('today')
  @HttpCode(200)
  @ApiOperation({ summary: '今日回复' })
  async replyToday(
    @CurrentUser('id') userId: string,
    @Body() body?: { replyMethod?: 'in_app' | 'notification_action' | 'apple_watch' },
  ) {
    const replyMethod = body?.replyMethod === 'notification_action' || body?.replyMethod === 'apple_watch'
      ? body.replyMethod
      : 'in_app';
    return this.replyService.replyToday(userId, replyMethod);
  }

  @Delete('today')
  @ApiOperation({ summary: '撤回今日回复' })
  async undoReply(@CurrentUser('id') userId: string) {
    return this.replyService.undoReply(userId);
  }

  @Get('status')
  @ApiOperation({ summary: '获取守护状态' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.replyService.getStatus(userId);
  }

  @Get('streak')
  @ApiOperation({ summary: '获取连续平安天数' })
  async getStreak(@CurrentUser('id') userId: string) {
    return this.replyService.getStreak(userId);
  }
}
