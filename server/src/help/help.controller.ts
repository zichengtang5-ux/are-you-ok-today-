import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HelpService } from './help.service';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('紧急求助')
@ApiBearerAuth()
@Controller('help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Post('emergency')
  @ApiOperation({ summary: '触发紧急求助' })
  async emergency(@CurrentUser('id') userId: string, @Body() dto: CreateEmergencyDto) {
    return this.helpService.emergency(userId, dto.latitude, dto.longitude, dto.addressText);
  }

  @Get('address')
  @ApiOperation({ summary: '获取当前地址' })
  async getAddress(@CurrentUser('id') userId: string) {
    return this.helpService.getAddress(userId);
  }
}
