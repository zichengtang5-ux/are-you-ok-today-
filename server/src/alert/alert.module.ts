import { Module } from '@nestjs/common';
import { ReplyController } from './reply.controller';
import { ReplyService } from './reply.service';

@Module({
  controllers: [ReplyController],
  providers: [ReplyService],
  exports: [ReplyService],
})
export class AlertModule {}
