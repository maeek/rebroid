import { Injectable, Logger } from '@nestjs/common';
import Dockerode from 'dockerode';
import { setTimeout as delay } from 'node:timers/promises';
import { DockerOperationQueue } from '../utils/docker-operation-queue';
import { dockerOperationScope } from '../utils/docker-operation-scope';
import {
  OperationDeadline,
  OperationDeadlineExceededError,
} from '../../../common/operation-deadline';
import type { DockerOperationOptions } from '../../contracts/docker-operation-options';
import { DockerConnection } from './docker-connection.factory';
import { DockerErrorClassifier } from './docker-error-classifier.service';
import { DockerMetricsObserver } from './docker-metrics-observer.service';

export class DockerLongOperationTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms.`);
    this.name = 'DockerLongOperationTimeoutError';
  }
}

@Injectable()
export class DockerOperationExecutor {
  private readonly logger = new Logger(DockerOperationExecutor.name);
  private readonly limitRead = new DockerOperationQueue();
  private readonly limitLongOperation = new DockerOperationQueue();
  private readonly mutationQueue = new DockerOperationQueue();
  private pendingMutations = 0;
  private pendingLongOperations = 0;
  private slowRequestWarningMs = 60_000;
  private longOperationTimeoutMs = 600_000;
  private transport: DockerConnection['transport'] = 'local-socket';
  private readonly pendingCoalescedReads = new Map<string, Promise<unknown>>();

  constructor(
    private readonly errors: DockerErrorClassifier,
    private readonly metrics: DockerMetricsObserver,
  ) {}

  configure(options: {
    transport: DockerConnection['transport'];
    maxConcurrentReads: number;
    maxConcurrentLongOperations: number;
    slowRequestWarningMs: number;
    longOperationTimeoutMs: number;
    remoteRequestTimeoutMs: number;
  }) {
    this.transport = options.transport;
    this.slowRequestWarningMs = options.slowRequestWarningMs;
    this.longOperationTimeoutMs = options.longOperationTimeoutMs;
    this.limitRead.setConcurrency(options.maxConcurrentReads);
    this.limitLongOperation.setConcurrency(options.maxConcurrentLongOperations);
    this.metrics.configure(options.transport, options);
  }

  get hasPendingMutations() {
    return this.pendingMutations > 0;
  }

  get hasPendingDockerWork() {
    return this.pendingMutations > 0 || this.pendingLongOperations > 0;
  }

  async read<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    description = 'Docker read',
    options?: DockerOperationOptions,
  ) {
    const operationName = this.stableOperation(description);
    const scope = dockerOperationScope(options);
    let queued = true;
    this.metrics.queueDockerOperation('read', 1);
    try {
      return await this.limitRead.run(async () => {
        queued = false;
        this.metrics.queueDockerOperation('read', -1);
        this.notifyDispatched(options);
        return this.observe('read', operationName, description, () =>
          this.retryTransient(
            () => operation(scope.signal),
            description,
            operationName,
            scope.signal,
          ),
        );
      }, options);
    } finally {
      scope.dispose();
      if (queued) this.metrics.queueDockerOperation('read', -1);
    }
  }

  async readStats<T>(operation: (signal: AbortSignal) => Promise<T>) {
    const signal = AbortSignal.timeout(4_000);
    let queued = true;
    this.metrics.queueDockerOperation('read', 1);
    try {
      return await this.limitRead.runBackground(async () => {
        queued = false;
        this.metrics.queueDockerOperation('read', -1);
        return this.observe(
          'read',
          'container_stats',
          'Collect Docker container resource usage',
          () => {
            signal.throwIfAborted();
            return operation(signal);
          },
          () => signal.aborted,
        );
      }, signal);
    } finally {
      if (queued) this.metrics.queueDockerOperation('read', -1);
    }
  }

  coalesceRead<T>(
    key: string,
    operation: () => Promise<T>,
    description = 'Docker read',
  ) {
    const existing = this.pendingCoalescedReads.get(key);
    if (existing) return existing as Promise<T>;
    const pending = this.read(operation, description).finally(() => {
      if (this.pendingCoalescedReads.get(key) === pending) {
        this.pendingCoalescedReads.delete(key);
      }
    });
    this.pendingCoalescedReads.set(key, pending);
    return pending;
  }

  async mutate<T>(
    operation: () => Promise<T>,
    description = 'Docker mutation',
    options?: DockerOperationOptions,
  ) {
    const operationName = this.stableOperation(description);
    let queued = true;
    this.pendingMutations += 1;
    this.metrics.queueDockerOperation('mutation', 1);
    try {
      return await this.mutationQueue.run(() => {
        queued = false;
        this.metrics.queueDockerOperation('mutation', -1);
        this.notifyDispatched(options);
        // Once dispatched, mutation ownership lasts until Docker settles.
        return this.observe('mutation', operationName, description, operation);
      }, options);
    } catch (error) {
      this.logger.warn(
        `${description} failed: ${this.errors.errorMessage(error)}`,
      );
      throw error;
    } finally {
      if (queued) this.metrics.queueDockerOperation('mutation', -1);
      this.pendingMutations -= 1;
    }
  }

  async longOperation<T>(
    operationName: string,
    description: string,
    docker: Dockerode,
    operation: (docker: Dockerode, signal: AbortSignal) => Promise<T>,
    timeoutMs = this.longOperationTimeoutMs,
    options?: DockerOperationOptions & { waitForCleanup?: boolean },
  ) {
    const deadline = options?.deadline
      ? new OperationDeadline(
          Math.min(timeoutMs, options.deadline.remainingMs()),
        )
      : undefined;
    const admission = { deadline, signal: options?.signal };
    let executionTimedOut = false;
    let queued = true;
    this.pendingLongOperations += 1;
    this.metrics.queueDockerOperation('long', 1);
    try {
      return await this.limitLongOperation.run(async () => {
        queued = false;
        this.metrics.queueDockerOperation('long', -1);
        this.notifyDispatched(options);
        return this.observe('long', operationName, description, async () => {
          // Legacy callers budget execution only; scoped startup work also
          // charges queue residence against its explicit deadline.
          const executionDeadline =
            deadline ?? new OperationDeadline(timeoutMs);
          const scope = dockerOperationScope({
            ...admission,
            deadline: executionDeadline,
          });
          let onAbort: (() => void) | undefined;
          const pending = Promise.resolve().then(() => {
            scope.signal.throwIfAborted();
            return operation(docker, scope.signal);
          });
          try {
            return await Promise.race([
              pending,
              new Promise<never>((_, reject) => {
                onAbort = () => {
                  executionTimedOut =
                    scope.signal.reason instanceof
                      OperationDeadlineExceededError &&
                    !options?.signal?.aborted;
                  reject(scope.signal.reason);
                };
                scope.signal.addEventListener('abort', onAbort, { once: true });
                if (scope.signal.aborted) onAbort();
              }),
            ]);
          } finally {
            if (onAbort) scope.signal.removeEventListener('abort', onAbort);
            scope.dispose();
            if (
              options?.waitForCleanup ||
              options?.deadline ||
              options?.signal
            ) {
              await pending.catch(() => undefined);
            }
          }
        });
      }, admission);
    } catch (error) {
      // Classify the abort that actually fired; timer delivery and the monotonic
      // clock can differ slightly, so a second deadline read is not authoritative.
      if (!options?.deadline && executionTimedOut) {
        throw new DockerLongOperationTimeoutError(description, timeoutMs);
      }
      throw error;
    } finally {
      if (queued) this.metrics.queueDockerOperation('long', -1);
      this.pendingLongOperations -= 1;
    }
  }

  private notifyDispatched(options?: DockerOperationOptions) {
    try {
      options?.onDispatched?.();
    } catch {
      // Diagnostics must not fail or repeat admitted Docker work.
    }
  }

  private async observe<T>(
    className: 'read' | 'mutation' | 'long',
    operationName: string,
    description: string,
    operation: () => Promise<T>,
    isTimeout: (error: unknown) => boolean = (error) =>
      error instanceof DockerLongOperationTimeoutError ||
      error instanceof OperationDeadlineExceededError,
  ) {
    return this.metrics.observe(
      className,
      operationName,
      description,
      this.transport,
      this.slowRequestWarningMs,
      isTimeout,
      operation,
    );
  }

  private async retryTransient<T>(
    operation: () => Promise<T>,
    description: string,
    operationName: string,
    signal?: AbortSignal,
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      signal?.throwIfAborted();
      try {
        const result = await operation();
        signal?.throwIfAborted();
        return result;
      } catch (error) {
        signal?.throwIfAborted();
        if (
          attempt === maxAttempts ||
          !this.errors.isTransientDockerTransportError(error)
        ) {
          throw error;
        }

        const errorCode = this.errors.errorCode(error) || 'transport';
        this.metrics.recordDockerRetry(operationName, errorCode);
        this.logger.warn(
          `${description} failed with a transient Docker transport error. Retrying ${attempt}/${maxAttempts - 1}: ${this.errors.errorMessage(error)}`,
        );
        try {
          await delay(
            250 * attempt + Math.floor(Math.random() * 100),
            undefined,
            { signal },
          );
        } catch (error) {
          signal?.throwIfAborted();
          throw error;
        }
      }
    }

    throw new Error(`${description} failed.`);
  }

  private stableOperation(description: string) {
    const normalized = description.toLowerCase();
    const mappings: [string, string][] = [
      ['ping ', 'ping'],
      ['inspect docker runtime', 'info'],
      ['connect container', 'network_connect'],
      ['disconnect container', 'network_disconnect'],
      ['create network', 'network_create'],
      ['remove network', 'network_remove'],
      ['inspect network', 'network_inspect'],
      ['start container', 'container_start'],
      ['stop container', 'container_stop'],
      ['remove container', 'container_remove'],
      ['create container', 'container_create'],
      ['inspect container', 'container_inspect'],
      ['list containers', 'container_list'],
      ['read logs', 'container_logs'],
      ['list images', 'image_list'],
      ['inspect image', 'image_inspect'],
      ['remove image', 'image_remove'],
      ['prune ', 'prune'],
    ];
    const mapped = mappings.find(([prefix]) => normalized.startsWith(prefix));
    if (mapped) return mapped[1];
    const verb = normalized.split(/[^a-z]+/).find(Boolean);
    return verb ? `${verb}_other` : 'docker_operation';
  }
}
