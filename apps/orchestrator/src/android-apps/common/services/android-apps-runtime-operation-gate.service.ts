import { ConflictException, Injectable } from '@nestjs/common';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { AndroidAutomationApplication } from '../../contracts/android-apps-automation.port';
import { AndroidAppsQueryService } from './android-apps-query.service';

@Injectable()
export class AndroidAppsRuntimeOperationGate {
  private readonly operations = new Map<string, Set<Promise<unknown>>>();
  private readonly interrupting = new Set<string>();

  constructor(private readonly queries: AndroidAppsQueryService) {}

  async run<T>(
    expected: AndroidAutomationApplication,
    signal: AbortSignal | undefined,
    operation: (app: AndroidAutomationApplication) => Promise<T>,
  ): Promise<T> {
    signal?.throwIfAborted();
    const id = expected.id;
    if (this.interrupting.has(id)) {
      throw new ConflictException('An Android runtime change is in progress.');
    }

    const active = this.operations.get(id) ?? new Set<Promise<unknown>>();
    const pending = Promise.resolve().then(async () => {
      signal?.throwIfAborted();
      const current = await this.queries.getStored(id);
      signal?.throwIfAborted();
      if (this.interrupting.has(id) || !matchesRuntime(expected, current)) {
        throw new ConflictException(
          'The Android runtime changed during this workflow run.',
        );
      }
      return operation(current);
    });
    active.add(pending);
    this.operations.set(id, active);
    try {
      return await pending;
    } finally {
      active.delete(pending);
      if (!active.size) this.operations.delete(id);
    }
  }

  async interrupt<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (this.interrupting.has(id)) {
      throw new ConflictException('An Android runtime change is in progress.');
    }
    this.interrupting.add(id);
    try {
      await Promise.allSettled(this.operations.get(id) ?? []);
      return await operation();
    } finally {
      this.interrupting.delete(id);
    }
  }
}

const matchesRuntime = (
  expected: AndroidAutomationApplication,
  current: AndroidAutomationApplication,
) =>
  current.status === AndroidApplicationStatus.Running &&
  current.containerId !== null &&
  current.containerId === expected.containerId &&
  current.ownerUserId === expected.ownerUserId &&
  current.containerName === expected.containerName &&
  current.networkName === expected.networkName &&
  current.adbPort === expected.adbPort &&
  current.profileMode === expected.profileMode &&
  (current.profileName || 'default') === (expected.profileName || 'default') &&
  current.lastStartedAt?.getTime() === expected.lastStartedAt?.getTime();
