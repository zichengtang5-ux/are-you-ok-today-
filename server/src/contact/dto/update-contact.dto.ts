import { IsString, IsOptional, IsInt, Matches, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContactDto {
  @ApiPropertyOptional({ description: '联系人姓名' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '联系人手机号' })
  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @ApiPropertyOptional({ description: '与用户关系' })
  @IsOptional()
  @IsString()
  relation?: string;

  @ApiPropertyOptional({ description: '优先级' })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}
