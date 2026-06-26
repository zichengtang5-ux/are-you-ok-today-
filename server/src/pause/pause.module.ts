import { Module } from '@nestjs/common';
import { PauseController } from './pause.controller';
import { PauseService } from './pause.service';

@Module({
  controllers: [PauseController],
  providers: [PauseService],
})
export class PauseModule {}
