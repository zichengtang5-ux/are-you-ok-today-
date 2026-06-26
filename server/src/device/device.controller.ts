import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('设备管理')
@ApiBearerAuth()
@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post('register')
  @ApiOperation({ summary: '上报 APNs device token' })
  async register(@CurrentUser('id') userId: string, @Body() dto: RegisterDeviceDto) {
    return this.deviceService.registerDevice(userId, dto.token, dto.platform);
  }
}
