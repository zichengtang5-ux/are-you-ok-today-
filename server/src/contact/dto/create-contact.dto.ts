import { IsString, IsOptional, IsInt, Matches, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ description: '联系人姓名', example: '妈妈' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '联系人手机号', example: '13812345678' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @ApiPropertyOptional({ description: '与用户关系', default: '家人' })
  @IsOptional()
  @IsString()
  relation?: string;

  @ApiPropertyOptional({ description: '优先级', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;
}
