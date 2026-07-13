import {
  IsBoolean,
  IsISO8601,
  IsIn,
  IsString,
  IsOptional,
  IsNumber,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmergencyDto {
  @ApiPropertyOptional({ description: 'GPS 纬度' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS 经度' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: '定位误差半径（米）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  accuracyMeters?: number;

  @ApiPropertyOptional({ description: '定位采集时间（ISO 8601）' })
  @IsOptional()
  @IsISO8601()
  locationCapturedAt?: string;

  @ApiPropertyOptional({ enum: ['live', 'last_known'] })
  @IsOptional()
  @IsIn(['live', 'last_known'])
  fixSource?: 'live' | 'last_known';

  @ApiPropertyOptional({ enum: ['full', 'reduced'] })
  @IsOptional()
  @IsIn(['full', 'reduced'])
  precisionAuthorization?: 'full' | 'reduced';

  @ApiPropertyOptional({ description: '地址文本（GPS 失败时使用预设地址）' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;

  @ApiPropertyOptional({ enum: ['manual', 'user_preset', 'apple_client'] })
  @IsOptional()
  @IsIn(['manual', 'user_preset', 'apple_client'])
  addressSource?: 'manual' | 'user_preset' | 'apple_client';

  @ApiPropertyOptional({ description: '用户是否手动确认过地址' })
  @IsOptional()
  @IsBoolean()
  addressConfirmed?: boolean;
}
