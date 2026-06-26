import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PauseDto {
  @ApiProperty({ description: '暂停天数 (1-30)', minimum: 1, maximum: 30, example: 7 })
  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;

  @ApiPropertyOptional({ description: '暂停原因' })
  @IsOptional()
  @IsString()
  reason?: string;
}
