import { Injectable, Logger } from '@nestjs/common';
import Dockerode from 'dockerode';
import { setTimeout as delay } from 'node:timers/promises';
import pLimit from 'p-limit';
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
  private limitRead: ReturnType<typeof pLimit> = pLimit(1);
  private limitLongOperation: ReturnType<typeof pLimit> = pLimit(1);
  private mutationQueue = Promise.resolve();
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
    this.limitRead = pLimit(options.maxConcurrentReads);
    this.limitLongOperation = pLimit(options.maxConcurrentLongOperations);
    this.metrics.configure(options.transport, options);
  }

  get hasPendingMutations() {
    return this.pendingMutations > 0;
  }

  get hasPendingDockerWork() {
    return this.pendingMutations > 0 || this.pendingLongOperations > 0;
  }

  async read<T>(operation: () => Promise<T>, description = 'Docker read') {
    const operationName = this.stableOperation(description);
    this.metrics.queueDockerOperation('read', 1);
    return this.limitRead(async () => {
      this.metrics.queueDockerOperation('read', -1);
      return this.observe('read', operationName, description, () =>
        this.retryTransient(operation, description, operationName),
      );
    });
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
  ) {
    const operationName = this.stableOperation(description);
    this.pendingMutations += 1;
    this.metrics.queueDockerOperation('mutation', 1);
    const queued = this.mutationQueue.then(
      () => {
        this.metrics.queueDockerOperation('mutation', -1);
        return this.observe('mutation', operationName, description, operation);
      },
      () => {
        this.metrics.queueDockerOperation('mutation', -1);
        return this.observe('mutation', operationName, description, operation);
      },
    );
    this.mutationQueue = queued.then(
      () => undefined,
      () => undefined,
    );

    try {
      return await queued;
    } catch (error) {
      this.logger.warn(
        `${description} failed: ${this.errors.errorMessage(error)}`,
      );
      throw error;
    } finally {
      this.pendingMutations -= 1;
    }
  }

  async longOperation<T>(
    operationName: string,
    description: string,
    docker: Dockerode,
    operation: (docker: Dockerode, signal: AbortSignal) => Promise<T>,
    timeoutMs = this.longOperationTimeoutMs,
  ) {
    this.pendingLongOperations += 1;
    this.metrics.queueDockerOperation('long', 1);
    try {
      return await this.limitLongOperation(async () => {
        this.metrics.queueDockerOperation('long', -1);
        return this.observe('long', operationName, description, async () => {
          const controller = new AbortController();
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            return await Promise.race([
              operation(docker, controller.signal),
              new Promise<never>((_, reject) => {
                timeout = setTimeout(() => {
                  reject(
                    new DockerLongOperationTimeoutError(description, timeoutMs),
                  );
                  controller.abort();
                }, timeoutMs);
              }),
            ]);
          } finally {
            if (timeout) clearTimeout(timeout);
          }
        });
      });
    } finally {
      this.pendingLongOperations -= 1;
    }
  }

  private async observe<T>(
    className: 'read' | 'mutation' | 'long',
    operationName: string,
    description: string,
    operation: () => Promise<T>,
  ) {
    return this.metrics.observe(
      className,
      operationName,
      description,
      this.transport,
      this.slowRequestWarningMs,
      (error) => error instanceof DockerLongOperationTimeoutError,
      operation,
    );
  }

  private async retryTransient<T>(
    operation: () => Promise<T>,
    description: string,
    operationName: string,
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
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
        await delay(250 * attempt + Math.floor(Math.random() * 100));
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
