import { Module } from '@nestjs/common';
import { ReplyController } from './reply.controller';
import { ReplyService } from './reply.service';
import { AlertController } from './alert.controller';

@Module({
  controllers: [ReplyController, AlertController],
  providers: [ReplyService],
  exports: [ReplyService],
})
export class AlertModule {}
