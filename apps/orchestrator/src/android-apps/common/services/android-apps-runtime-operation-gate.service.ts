import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { isIPv4 } from 'node:net';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import type { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type {
  ManagedAutomationApplication,
  ManagedAutomationTarget,
} from '../../contracts/android-apps-automation.port';
import {
  runtimeIdentityKey,
  type AndroidRuntimeIdentity,
} from '../utils/android-runtime-identity';
import { AndroidAppsQueryService } from './android-apps-query.service';

type ActiveOperations = Map<Promise<unknown>, (() => void) | undefined>;

export class AndroidRuntimeNotRunningError extends ConflictException {}

@Injectable()
export class AndroidAppsRuntimeOperationGate {
  private readonly operations = new Map<string, ActiveOperations>();
  private readonly interrupting = new Set<string>();

  constructor(
    private readonly queries: AndroidAppsQueryService,
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly containers: DockerContainerLifecyclePort,
  ) {}

  capture(app: ManagedAutomationApplication, signal: AbortSignal) {
    return this.withCurrentRuntime(app, signal, async (target) => target);
  }

  run<T>(
    expected: ManagedAutomationTarget,
    signal: AbortSignal | undefined,
    operation: (app: ManagedAutomationApplication) => Promise<T>,
  ): Promise<T> {
    return this.withCurrentRuntime(expected, signal, (target) => {
      if (target.containerStartedAt !== expected.containerStartedAt) {
        throw this.runtimeChanged();
      }
      return operation(target);
    });
  }

  async withCurrentRuntime<T>(
    expected: AndroidRuntimeIdentity,
    signal: AbortSignal | undefined,
    operation: (
      target: AndroidApplication & { containerStartedAt: string },
      managedAdbHost: string | null,
    ) => Promise<T>,
    cancel?: () => void,
  ): Promise<T> {
    signal?.throwIfAborted();
    const id = expected.id;
    return this.withApplicationOperation(
      id,
      async () => {
        signal?.throwIfAborted();
        const current = await this.queries.getStored(id);
        signal?.throwIfAborted();
        if (
          this.interrupting.has(id) ||
          !current.containerId ||
          current.status !== AndroidApplicationStatus.Running ||
          workflowRuntimeKey(expected) !== workflowRuntimeKey(current)
        ) {
          throw this.runtimeChanged();
        }
        const observed = await this.observeContainer(current, signal);
        signal?.throwIfAborted();
        if (this.interrupting.has(id) || !observed) {
          throw this.runtimeChanged();
        }
        if (!observed.running) {
          throw new AndroidRuntimeNotRunningError(
            this.runtimeChanged().message,
          );
        }
        const { containerStartedAt, managedAdbHost } = observed;
        if (!containerStartedAt) {
          throw this.runtimeChanged();
        }
        return operation({ ...current, containerStartedAt }, managedAdbHost);
      },
      cancel,
    );
  }

  async withApplicationOperation<T>(
    id: string,
    operation: () => Promise<T>,
    cancel?: () => void,
  ): Promise<T> {
    if (this.interrupting.has(id)) {
      throw new ConflictException('An Android runtime change is in progress.');
    }

    const active: ActiveOperations = this.operations.get(id) ?? new Map();
    const pending = Promise.resolve().then(operation);
    active.set(pending, cancel);
    this.operations.set(id, active);
    try {
      return await pending;
    } finally {
      active.delete(pending);
      if (!active.size) this.operations.delete(id);
    }
  }

  async observeContainer(
    app: Pick<AndroidApplication, 'id' | 'containerId' | 'networkName'>,
    signal?: AbortSignal,
  ) {
    if (!app.containerId) return null;
    const container = await this.containers.inspectContainer(
      app.containerId,
      signal ? { signal } : undefined,
    );
    if (container.Id !== app.containerId) return null;

    const state = container.State;
    const running = Boolean(state?.Running && !state.Restarting);
    const labels = container.Config?.Labels;
    const host =
      container.NetworkSettings?.Networks?.[app.networkName]?.IPAddress;
    const managedAdbHost =
      running &&
      !state?.Paused &&
      labels?.['com.rebroid.managed'] === 'true' &&
      labels['com.rebroid.application-id'] === app.id &&
      labels['com.rebroid.component'] === 'runtime' &&
      host &&
      isIPv4(host)
        ? host
        : null;
    return { running, containerStartedAt: state?.StartedAt, managedAdbHost };
  }

  async interrupt<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (this.interrupting.has(id)) {
      throw new ConflictException('An Android runtime change is in progress.');
    }
    this.interrupting.add(id);
    try {
      const active = this.operations.get(id);
      for (const cancel of new Set(active?.values())) cancel?.();
      await Promise.allSettled(active?.keys() ?? []);
      return await operation();
    } finally {
      this.interrupting.delete(id);
    }
  }

  async runIfIdle<T>(id: string, operation: () => Promise<T>) {
    if (this.interrupting.has(id) || this.operations.has(id)) return;
    // Admission and the fence are synchronous. There is no admitted work to cancel.
    this.interrupting.add(id);
    try {
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

const workflowRuntimeKey = (app: AndroidRuntimeIdentity) =>
  runtimeIdentityKey(app, app.profileName || 'default');
