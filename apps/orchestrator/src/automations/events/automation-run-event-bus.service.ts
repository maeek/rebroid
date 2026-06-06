import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { AutomationRunEventsRepository } from '../persistence/automation-run-events.repository';
import type {
  AutomationRunEventInput,
  AutomationRunEventRecord,
} from './automation-run-events.types';

@Injectable()
export class AutomationRunEventBus {
  private readonly emitter = new EventEmitter();

  constructor(private readonly events: AutomationRunEventsRepository) {
    this.emitter.setMaxListeners(200);
  }

  async emit(input: AutomationRunEventInput) {
    const event = await this.events.append(input);
    this.emitter.emit(input.runId, event);
    return event;
  }

  list(ownerUserId: string, runId: string, after?: number) {
    return this.events.listForRun(ownerUserId, runId, after);
  }

  deleteForRuns(ownerUserId: string, runIds: string[]) {
    return this.events.deleteForRuns(ownerUserId, runIds);
  }

  subscribe(
    runId: string,
    listener: (event: AutomationRunEventRecord) => void,
  ) {
    this.emitter.on(runId, listener);
    return () => this.emitter.off(runId, listener);
  }
}
