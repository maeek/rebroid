import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { AutomationRunEventsRepository } from '../persistence/automation-run-events.repository';
import type {
  AutomationRunEventInput,
  AutomationRunEventRecord,
} from './automation-run-events.types';

const maxBufferedReplayEvents = 1_000;

@Injectable()
export class AutomationRunEventBus {
  private readonly logger = new Logger(AutomationRunEventBus.name);
  private readonly emitter = new EventEmitter();

  constructor(private readonly events: AutomationRunEventsRepository) {
    this.emitter.setMaxListeners(200);
  }

  async emit(input: AutomationRunEventInput) {
    const event = await this.events.append(input);
    this.publish(event);
    return event;
  }

  async transitionRun(
    ...args: Parameters<AutomationRunEventsRepository['transitionRun']>
  ) {
    const result = await this.events.transitionRun(...args);
    if (!result) return null;
    this.publish(result.event);
    return result.run;
  }

  private publish(event: AutomationRunEventRecord) {
    for (const listener of this.emitter.listeners(event.runId)) {
      try {
        listener(event);
      } catch {
        this.logger.warn('Automation event listener failed after persistence.');
      }
    }
  }

  list(ownerUserId: string, runId: string, after?: number) {
    return this.events.listForRun(ownerUserId, runId, after);
  }

  listConversationEvents(ownerUserId: string, runIds: string[]) {
    return this.events.listConversationEvents(ownerUserId, runIds);
  }

  findFailureRequestId(ownerUserId: string, runId: string) {
    return this.events.findFailureRequestId(ownerUserId, runId);
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
    signal?: AbortSignal,
  ) {
    if (signal?.aborted) return () => undefined;
    let lastSequence = Math.max(0, Math.trunc(after));
    let replaying = true;
    let overflow = false;
    const buffered: AutomationRunEventRecord[] = [];
    const removeListener = this.subscribe(runId, (event) => {
      if (event.ownerUserId !== ownerUserId) {
        return;
      }
      if (signal?.aborted) return;
      if (replaying) {
        if (buffered.length >= maxBufferedReplayEvents) {
          overflow = true;
          return;
        }
        buffered.push(event);
        return;
      }
      if (event.sequence <= lastSequence) return;
      listener(event);
      lastSequence = event.sequence;
    });
    const unsubscribe = () => {
      removeListener();
      signal?.removeEventListener('abort', unsubscribe);
    };
    signal?.addEventListener('abort', unsubscribe, { once: true });

    try {
      const through = await this.events.latestSequence(ownerUserId, runId);
      while (lastSequence < through && !signal?.aborted) {
        const replay = await this.list(ownerUserId, runId, lastSequence);
        if (overflow)
          throw new Error('Automation event replay buffer exceeded its limit.');
        if (signal?.aborted) break;
        if (replay.length === 0) break;
        const previousSequence = lastSequence;
        for (const event of replay) {
          if (signal?.aborted || event.sequence > through) break;
          listener(event);
          lastSequence = event.sequence;
        }
        if (lastSequence === previousSequence) break;
      }
      if (signal?.aborted) {
        unsubscribe();
        return unsubscribe;
      }
      if (overflow)
        throw new Error('Automation event replay buffer exceeded its limit.');
      replaying = false;
      for (const event of buffered.sort(
        (left, right) => left.sequence - right.sequence,
      )) {
        if (signal?.aborted) break;
        if (event.sequence <= lastSequence) continue;
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
