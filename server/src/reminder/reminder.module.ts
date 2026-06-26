import { Module } from '@nestjs/common';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';
import { ReminderCronService } from './reminder-cron.service';

@Module({
  controllers: [ReminderController],
  providers: [ReminderService, ReminderCronService],
})
export class ReminderModule {}
