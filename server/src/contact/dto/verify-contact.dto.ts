import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyContactDto {
  @ApiProperty({ description: '6位验证码', example: '123456' })
  @IsString()
  @Length(6, 6, { message: '验证码为6位数字' })
  code!: string;
}
