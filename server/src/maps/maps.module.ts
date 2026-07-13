import { Module } from '@nestjs/common';
import { AppleMapsService } from './apple-maps.service';

@Module({
  providers: [AppleMapsService],
  exports: [AppleMapsService],
})
export class MapsModule {}
