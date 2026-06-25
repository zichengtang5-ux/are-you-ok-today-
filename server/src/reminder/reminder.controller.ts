import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReminderService } from './reminder.service';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('提醒配置')
@ApiBearerAuth()
@Controller('reminder')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Get('config')
  @ApiOperation({ summary: '获取提醒配置' })
  async getConfig(@CurrentUser('id') userId: string) {
    return this.reminderService.getConfig(userId);
  }

  @Patch('config')
  @ApiOperation({ summary: '更新提醒配置' })
  async updateConfig(@CurrentUser('id') userId: string, @Body() dto: UpdateReminderDto) {
    return this.reminderService.updateConfig(userId, dto);
  }
}
