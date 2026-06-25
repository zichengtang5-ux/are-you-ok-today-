import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmergencyDto {
  @ApiPropertyOptional({ description: 'GPS 纬度' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS 经度' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: '地址文本（GPS 失败时使用预设地址）' })
  @IsOptional()
  @IsString()
  addressText?: string;
}
