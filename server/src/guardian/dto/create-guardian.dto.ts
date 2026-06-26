import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuardianDto {
  @ApiProperty({ description: '被守护人姓名', example: '妈妈' })
  @IsString()
  @IsNotEmpty()
  wardName!: string;

  @ApiProperty({ description: '被守护人手机号', example: '13811112222' })
  @IsString()
  @IsNotEmpty()
  wardPhone!: string;

  @ApiPropertyOptional({ description: '关系', default: '子女' })
  @IsOptional()
  @IsString()
  relation?: string;
}
