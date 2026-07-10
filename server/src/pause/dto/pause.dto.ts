import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PauseDto {
  @ApiProperty({ description: '暂停天数 (1-14)', minimum: 1, maximum: 14, example: 3 })
  @IsInt()
  @Min(1)
  @Max(14)
  days!: number;

  @ApiPropertyOptional({ description: '暂停原因' })
  @IsOptional()
  @IsString()
  reason?: string;
}
