import { Module } from '@nestjs/common';
import { AutomationsPersistenceModule } from '../persistence/automations-persistence.module';
import { AutomationRunEventBus } from './automation-run-event-bus.service';
import { AutomationRunEventStreamService } from './automation-run-event-stream.service';

@Module({
  imports: [AutomationsPersistenceModule],
  providers: [AutomationRunEventBus, AutomationRunEventStreamService],
  exports: [AutomationRunEventBus, AutomationRunEventStreamService],
})
export class AutomationEventsModule {}
