import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendCodeDto {
  @ApiProperty({ description: '手机号', example: '13812345678' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;
}
