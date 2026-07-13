import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ONBOARDING_STEPS = [
  'login',
  'agreement',
  'basic-info',
  'contact-setup',
  'reminder-time',
  'notification-auth',
  'complete',
] as const;

export class UpdateOnboardingDto {
  @ApiProperty({ enum: ONBOARDING_STEPS })
  @IsString()
  @IsIn(ONBOARDING_STEPS)
  step!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOnboarded?: boolean;
}
