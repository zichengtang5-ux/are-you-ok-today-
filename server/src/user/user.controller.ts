import { Controller, Get, Patch, Delete, Body, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

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
    @Body() body: UpdateOnboardingDto,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStep: body.step,
        ...(body.isOnboarded !== undefined ? { isOnboarded: body.isOnboarded } : {}),
      },
    });
  }

  @Delete('account')
  @ApiOperation({ summary: '删除账号和所有数据' })
  async deleteAccount(@CurrentUser('id') userId: string, @Body() dto: DeleteAccountDto) {
    if (dto.confirmation !== '确认删除') {
      throw new BadRequestException('确认文本不正确');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.alertAction.deleteMany({
        where: { alert: { userId } },
      });
      await tx.alertEvent.deleteMany({ where: { userId } });
      await tx.notificationLog.deleteMany({
        where: { contact: { userId } },
      });

      await tx.emergencyContact.updateMany({
        where: { phone: user.phone, userId: { not: userId } },
        data: { isAccountDeleted: true },
      });

      await tx.emergencyContact.deleteMany({ where: { userId } });
      await tx.dailyRecord.deleteMany({ where: { userId } });
      await tx.guardStatus.deleteMany({ where: { userId } });
      await tx.reminderConfig.deleteMany({ where: { userId } });
      await tx.pauseLog.deleteMany({ where: { userId } });
      await tx.helpRequest.deleteMany({ where: { userId } });
      await tx.agreementConsent.deleteMany({ where: { userId } });
      await tx.device.deleteMany({ where: { userId } });
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.verificationCode.deleteMany({
        where: { phone: user.phone },
      });
      await tx.user.delete({ where: { id: userId } });
    });

    return {
      message: '账号已删除，你的紧急联系人将不再收到通知',
    };
  }
}
