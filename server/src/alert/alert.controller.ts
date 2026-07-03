import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AlertService } from './alert.service';

@ApiTags('告警')
@ApiBearerAuth()
@Controller('alert')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Get('active')
  @ApiOperation({ summary: '获取当前活跃告警' })
  async getActiveAlert(@CurrentUser('id') userId: string) {
    return this.alertService.getActiveAlert(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取指定告警详情' })
  async getAlert(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query('contactId') contactId?: string,
  ) {
    return this.alertService.getAlert(userId, id, contactId);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: '联系人确认安全并解除告警' })
  async confirm(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { contactId: string },
  ) {
    return this.alertService.confirm(userId, id, body.contactId);
  }

  @Post(':id/help')
  @HttpCode(200)
  @ApiOperation({ summary: '联系人标记需要帮助' })
  async needHelp(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { contactId: string },
  ) {
    return this.alertService.needHelp(userId, id, body.contactId);
  }
}
