import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifySubscriptionDto {
  @ApiProperty({ description: 'Apple transaction ID' })
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @ApiProperty({ description: '订阅计划', enum: ['monthly', 'yearly'] })
  @IsString()
  @IsIn(['monthly', 'yearly'])
  plan!: string;

  @ApiPropertyOptional({ description: '支付平台（预留扩展）', enum: ['apple'], default: 'apple' })
  @IsOptional()
  @IsString()
  @IsIn(['apple'])
  provider?: string;
}
