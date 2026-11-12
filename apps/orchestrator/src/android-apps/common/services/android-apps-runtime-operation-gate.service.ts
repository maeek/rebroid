import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type {
  AndroidAutomationApplication,
  AndroidAutomationTarget,
} from '../../contracts/android-apps-automation.port';
import { AndroidAppsQueryService } from './android-apps-query.service';

@Injectable()
export class AndroidAppsRuntimeOperationGate {
  private readonly operations = new Map<string, Set<Promise<unknown>>>();
  private readonly interrupting = new Set<string>();

  constructor(
    private readonly queries: AndroidAppsQueryService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly containers: DockerContainerLifecyclePort,
  ) {}

  capture(app: AndroidAutomationApplication, signal: AbortSignal) {
    return this.withCurrentRuntime(app, signal, async (target) => target);
  }

  run<T>(
    expected: AndroidAutomationTarget,
    signal: AbortSignal | undefined,
    operation: (app: AndroidAutomationApplication) => Promise<T>,
  ): Promise<T> {
    return this.withCurrentRuntime(expected, signal, (target) => {
      if (target.containerStartedAt !== expected.containerStartedAt) {
        throw this.runtimeChanged();
      }
      return operation(target);
    });
  }

  private async withCurrentRuntime<T>(
    expected: AndroidAutomationApplication,
    signal: AbortSignal | undefined,
    operation: (target: AndroidAutomationTarget) => Promise<T>,
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
      if (
        this.interrupting.has(id) ||
        !current.containerId ||
        !matchesRuntime(expected, current)
      ) {
        throw this.runtimeChanged();
      }
      const container = await this.containers.inspectContainer(
        current.containerId,
      );
      signal?.throwIfAborted();
      const containerStartedAt = container.State?.StartedAt;
      if (
        this.interrupting.has(id) ||
        container.Id !== current.containerId ||
        !container.State?.Running ||
        container.State.Restarting ||
        !containerStartedAt
      ) {
        throw this.runtimeChanged();
      }
      return operation({ ...current, containerStartedAt });
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

  private runtimeChanged() {
    return new ConflictException(
      'The Android runtime changed during this workflow run.',
    );
  }
}

const matchesRuntime = (
  expected: AndroidAutomationApplication,
  current: AndroidAutomationApplication,
) =>
  current.status === AndroidApplicationStatus.Running &&
  current.containerId === expected.containerId &&
  current.ownerUserId === expected.ownerUserId &&
  current.containerName === expected.containerName &&
  current.networkName === expected.networkName &&
  current.adbPort === expected.adbPort &&
  current.profileMode === expected.profileMode &&
  (current.profileName || 'default') === (expected.profileName || 'default') &&
  current.lastStartedAt?.getTime() === expected.lastStartedAt?.getTime();
