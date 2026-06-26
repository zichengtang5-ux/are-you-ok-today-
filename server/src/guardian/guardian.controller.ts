import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuardianService } from './guardian.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('守护关系（子女端）')
@ApiBearerAuth()
@Controller('guardian')
export class GuardianController {
  constructor(private readonly guardianService: GuardianService) {}

  @Post('create')
  @ApiOperation({ summary: '创建守护档案' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateGuardianDto) {
    return this.guardianService.create(userId, dto.wardName, dto.wardPhone, dto.relation ?? '子女');
  }

  @Post('accept-invite')
  @ApiOperation({ summary: '接受邀请' })
  async acceptInvite(@CurrentUser('id') userId: string, @Body() dto: AcceptInviteDto) {
    return this.guardianService.acceptInvite(userId, dto.inviteCode);
  }

  @Get('wards')
  @ApiOperation({ summary: '守护列表' })
  async getWards(@CurrentUser('id') userId: string) {
    return this.guardianService.getWards(userId);
  }

  @Get('wards/:id/dashboard')
  @ApiOperation({ summary: '关怀看板' })
  async getDashboard(@CurrentUser('id') userId: string, @Param('id') relationId: string) {
    return this.guardianService.getDashboard(userId, relationId);
  }

  @Post('wards/:id/proxy-reply')
  @ApiOperation({ summary: '子女代确认' })
  async proxyReply(@CurrentUser('id') userId: string, @Param('id') relationId: string) {
    return this.guardianService.proxyReply(userId, relationId);
  }
}
