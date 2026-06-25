import { Module } from '@nestjs/common';
import { GuardianController } from './guardian.controller';
import { GuardianService } from './guardian.service';
import { AlertModule } from '../alert/alert.module';

@Module({
  imports: [AlertModule],
  controllers: [GuardianController],
  providers: [GuardianService],
})
export class GuardianModule {}
