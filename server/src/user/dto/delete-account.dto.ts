import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({ description: '确认文本，必须为"确认删除"', example: '确认删除' })
  @IsString()
  @IsNotEmpty()
  confirmation!: string;
}
