import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PauseService } from './pause.service';
import { PauseDto } from './dto/pause.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('暂停守护')
@ApiBearerAuth()
@Controller('pause')
export class PauseController {
  constructor(private readonly pauseService: PauseService) {}

  @Post()
  @ApiOperation({ summary: '暂停守护' })
  async pause(@CurrentUser('id') userId: string, @Body() dto: PauseDto) {
    return this.pauseService.pause(userId, dto.days, dto.reason);
  }

  @Post('resume')
  @ApiOperation({ summary: '提前恢复守护' })
  async resume(@CurrentUser('id') userId: string) {
    return this.pauseService.resume(userId);
  }

  @Get('status')
  @ApiOperation({ summary: '获取暂停状态' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.pauseService.getStatus(userId);
  }
}
