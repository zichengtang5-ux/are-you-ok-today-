import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'APNs device token', example: 'abc123def456...' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: '设备平台', enum: ['ios', 'android'], default: 'ios' })
  @IsString()
  @IsIn(['ios', 'android'])
  platform!: string;
}
