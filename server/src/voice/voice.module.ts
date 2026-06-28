import { Global, Module } from '@nestjs/common';
import { VoiceService } from './voice.service';

@Global()
@Module({
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
