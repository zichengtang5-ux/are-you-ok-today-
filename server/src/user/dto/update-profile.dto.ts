import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nickname?: string;

  @ApiPropertyOptional({ description: '当前住址' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ description: '住址定位纬度', nullable: true })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsLatitude()
  addressLatitude?: number | null;

  @ApiPropertyOptional({ description: '住址定位经度', nullable: true })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsLongitude()
  addressLongitude?: number | null;

  @ApiPropertyOptional({ description: '住址定位误差半径（米）', nullable: true })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsNumber()
  @Min(0)
  addressAccuracyMeters?: number | null;

  @ApiPropertyOptional({ description: '通知授权状态' })
  @IsOptional()
  @IsBoolean()
  notificationAuth?: boolean;
}
