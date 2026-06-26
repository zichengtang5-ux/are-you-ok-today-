import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProxySubscribeDto {
  @ApiProperty({ description: '被守护用户 ID' })
  @IsString()
  @IsNotEmpty()
  wardId!: string;

  @ApiProperty({ description: 'Apple transaction ID' })
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @ApiProperty({ description: '订阅计划', enum: ['monthly', 'yearly'] })
  @IsString()
  @IsIn(['monthly', 'yearly'])
  plan!: string;
}
