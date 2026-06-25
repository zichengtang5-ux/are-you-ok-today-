import { IsString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReminderDto {
  @ApiPropertyOptional({ description: '提醒窗口开始时间', example: '20:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: '时间格式为 HH:mm' })
  startTime?: string;

  @ApiPropertyOptional({ description: '提醒窗口结束时间', example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: '时间格式为 HH:mm' })
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
