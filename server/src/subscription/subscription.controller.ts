import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { VerifySubscriptionDto } from './dto/verify-subscription.dto';
import { ProxySubscribeDto } from './dto/proxy-subscribe.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('订阅付费')
@ApiBearerAuth()
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('verify')
  @ApiOperation({ summary: '校验 Apple IAP 交易' })
  async verify(@CurrentUser('id') userId: string, @Body() dto: VerifySubscriptionDto) {
    return this.subscriptionService.verify(userId, dto.transactionId, dto.plan);
  }

  @Post('proxy-subscribe')
  @ApiOperation({ summary: '子女代付' })
  async proxySubscribe(@CurrentUser('id') userId: string, @Body() dto: ProxySubscribeDto) {
    return this.subscriptionService.proxySubscribe(userId, dto.wardId, dto.transactionId, dto.plan);
  }

  @Get('status')
  @ApiOperation({ summary: '获取订阅状态' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getStatus(userId);
  }
}
