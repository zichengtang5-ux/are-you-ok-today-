import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('用户')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private prisma: PrismaService) {}

  @Get('profile')
  @ApiOperation({ summary: '获取用户资料' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  @Patch('profile')
  @ApiOperation({ summary: '更新用户资料' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { ...dto },
    });
  }

  @Patch('onboarding')
  @ApiOperation({ summary: '更新引导进度' })
  async updateOnboarding(
    @CurrentUser('id') userId: string,
    @Body() body: { step: string; isOnboarded?: boolean },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStep: body.step,
        ...(body.isOnboarded !== undefined ? { isOnboarded: body.isOnboarded } : {}),
      },
    });
  }
}
