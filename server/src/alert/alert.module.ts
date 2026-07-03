import { Module } from '@nestjs/common';
import { ReplyController } from './reply.controller';
import { ReplyService } from './reply.service';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';

@Module({
  controllers: [ReplyController, AlertController],
  providers: [ReplyService, AlertService],
  exports: [ReplyService],
})
export class AlertModule {}
