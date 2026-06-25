import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCodeDto {
  @ApiProperty({ description: '手机号', example: '13812345678' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string;

  @ApiProperty({ description: '6位验证码', example: '123456' })
  @IsString()
  @Length(6, 6, { message: '验证码为6位数字' })
  code!: string;
}
