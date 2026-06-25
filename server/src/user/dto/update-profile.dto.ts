import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ description: '当前住址' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '通知授权状态' })
  @IsOptional()
  notificationAuth?: boolean;}
