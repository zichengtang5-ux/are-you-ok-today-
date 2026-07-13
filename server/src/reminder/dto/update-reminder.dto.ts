import { IsString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReminderDto {
  @ApiPropertyOptional({ description: '提醒窗口开始时间', example: '20:00' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):00$/, { message: '提醒时间须为 00:00 至 23:00 的整点' })
  startTime?: string;

  @ApiPropertyOptional({ description: '提醒窗口结束时间', example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):00$/, { message: '提醒时间须为 00:00 至 23:00 的整点' })
  endTime?: string;

  @ApiPropertyOptional({ description: '宽限时间（分钟）', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  gracePeriodMin?: number;

  @ApiPropertyOptional({ description: '时区', default: 'Asia/Shanghai' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
