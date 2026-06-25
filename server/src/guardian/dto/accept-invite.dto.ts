import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: '邀请码', example: 'ABC123XYZ' })
  @IsString()
  @IsNotEmpty()
  inviteCode!: string;
}
