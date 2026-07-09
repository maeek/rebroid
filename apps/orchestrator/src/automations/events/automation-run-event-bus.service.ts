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

  async subscribeWithReplay(
    ownerUserId: string,
    runId: string,
    after: number,
    listener: (event: AutomationRunEventRecord) => void,
  ) {
    let replaying = true;
    const buffered: AutomationRunEventRecord[] = [];
    const unsubscribe = this.subscribe(runId, (event) => {
      if (event.ownerUserId !== ownerUserId) {
        return;
      }
      if (replaying) {
        buffered.push(event);
        return;
      }
      listener(event);
    });

    try {
      const replay = await this.list(ownerUserId, runId, after);
      let lastSequence = Math.max(0, Math.trunc(after));
      for (const event of replay) {
        listener(event);
        lastSequence = Math.max(lastSequence, event.sequence);
      }

      replaying = false;
      for (const event of buffered
        .filter((candidate) => candidate.sequence > lastSequence)
        .sort((left, right) => left.sequence - right.sequence)) {
        listener(event);
        lastSequence = event.sequence;
      }
      return unsubscribe;
    } catch (error) {
      unsubscribe();
      throw error;
    }
  }
}
