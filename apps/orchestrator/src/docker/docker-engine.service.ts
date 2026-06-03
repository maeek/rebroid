import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { setTimeout as delay } from 'node:timers/promises';
import pLimit from 'p-limit';
import { getErrorMessage } from '../common/error-message';
import {
  MetricsService,
  type DockerOperationClass,
} from '../metrics/metrics.service';
import { hasDockerStatusCode } from './utils/docker-engine.utils';

interface DockerConnection {
  options: Dockerode.DockerOptions;
  transport: 'local-socket' | 'remote';
}

export const dockerConnectionOptions = (
  dockerHost: string | undefined,
  socketPath: string,
  remoteRequestTimeoutMs: number,
  timerFree = false,
): DockerConnection => {
  const normalizedHost = dockerHost?.trim();
  if (!normalizedHost) {
    return { options: { socketPath }, transport: 'local-socket' };
  }

  if (normalizedHost.startsWith('unix://')) {
    const url = new URL(normalizedHost);
    return {
      options: { socketPath: decodeURIComponent(url.pathname) },
      transport: 'local-socket',
    };
  }

  const requestOptions = timerFree ? {} : { timeout: remoteRequestTimeoutMs };
  if (
    normalizedHost.startsWith('tcp://') ||
    normalizedHost.startsWith('http://') ||
    normalizedHost.startsWith('https://')
  ) {
    const url = new URL(
      normalizedHost.startsWith('tcp://')
        ? `http://${normalizedHost.slice('tcp://'.length)}`
        : normalizedHost,
    );
    const protocol: Dockerode.DockerOptions['protocol'] =
      url.protocol === 'https:' ? 'https' : 'http';

    return {
      options: {
        protocol,
        host: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        ...requestOptions,
      },
      transport: 'remote',
    };
  }

  return {
    options: { host: normalizedHost, ...requestOptions },
    transport: 'remote',
  };
};

class DockerLongOperationTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms.`);
    this.name = 'DockerLongOperationTimeoutError';
  }
}

@Injectable()
export class DockerEngineService {
  private readonly logger = new Logger(DockerEngineService.name);
  private readonly limitRead: ReturnType<typeof pLimit>;
  private readonly limitLongOperation: ReturnType<typeof pLimit>;
  private readonly slowRequestWarningMs: number;
  private readonly longOperationTimeoutMs: number;
  private mutationQueue = Promise.resolve();
  private pendingMutations = 0;
  private pendingLongOperations = 0;
  private readonly pendingCoalescedReads = new Map<string, Promise<unknown>>();
  readonly docker: Dockerode;
  readonly streamDocker: Dockerode;
  readonly resourcePrefix: string;
  readonly orchestratorContainerId?: string;
  readonly transport: DockerConnection['transport'];

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService = new MetricsService(),
  ) {
    const dockerHost = process.env.DOCKER_HOST;
    const socketPath = this.config.getOrThrow<string>('app.docker.socketPath');
    const remoteRequestTimeoutMs = this.config.getOrThrow<number>(
      'app.docker.requestTimeoutMs',
    );
    const connection = dockerConnectionOptions(
      dockerHost,
      socketPath,
      remoteRequestTimeoutMs,
    );
    this.docker = new Dockerode(connection.options);
    this.streamDocker = new Dockerode(
      dockerConnectionOptions(
        dockerHost,
        socketPath,
        remoteRequestTimeoutMs,
        true,
      ).options,
    );
    this.transport = connection.transport;
    this.resourcePrefix = this.config.getOrThrow<string>(
      'app.docker.resourcePrefix',
    );
    this.orchestratorContainerId = this.config.get<string>(
      'app.docker.orchestratorContainerId',
    );
    const maxConcurrentReads = this.config.getOrThrow<number>(
      'app.docker.maxConcurrentReads',
    );
    const maxConcurrentLongOperations = this.config.getOrThrow<number>(
      'app.docker.maxConcurrentLongOperations',
    );
    this.slowRequestWarningMs = this.config.getOrThrow<number>(
      'app.docker.slowRequestWarningMs',
    );
    this.longOperationTimeoutMs = this.config.getOrThrow<number>(
      'app.docker.longOperationTimeoutMs',
    );
    this.limitRead = pLimit(maxConcurrentReads);
    this.limitLongOperation = pLimit(maxConcurrentLongOperations);
    this.metrics.configureDocker(this.transport, {
      maxConcurrentReads,
      maxConcurrentLongOperations,
      slowRequestWarningMs: this.slowRequestWarningMs,
      longOperationTimeoutMs: this.longOperationTimeoutMs,
      remoteRequestTimeoutMs,
    });
  }

  async ping() {
    await this.read(() => this.docker.ping(), 'Ping Docker API');
  }

  async info() {
    return this.read(() => this.docker.info(), 'Inspect Docker runtime info');
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
    // A socket reset does not prove that Docker rejected a mutation. Replaying
    // start, stop, remove, or network connect requests can duplicate side
    // effects and amplify daemon stalls.
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
      this.logger.warn(`${description} failed: ${this.errorMessage(error)}`);
      throw error;
    } finally {
      this.pendingMutations -= 1;
    }
  }

  async longOperation<T>(
    operationName: string,
    description: string,
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
              operation(this.streamDocker, controller.signal),
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

  /**
   * Builds the label set used to identify orchestrator-managed Docker resources.
   */
  labels(applicationId: string, component: string) {
    return {
      'com.rebroid.managed': 'true',
      'com.rebroid.application-id': applicationId,
      'com.rebroid.component': component,
      'com.rebroid.resource-prefix': this.resourcePrefix,
    };
  }

  isDockerConflict(error: unknown) {
    return hasDockerStatusCode(error, 409);
  }

  isDockerForbidden(error: unknown) {
    return hasDockerStatusCode(error, 403);
  }

  isDockerNotFound(error: unknown) {
    return hasDockerStatusCode(error, 404);
  }

  isDockerNotModified(error: unknown) {
    return hasDockerStatusCode(error, 304);
  }

  isContainerAlreadyConnectedToNetwork(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('already connected') ||
      (message.includes('endpoint with name') &&
        message.includes('already exists') &&
        message.includes('network'))
    );
  }

  isContainerAlreadyDisconnectedFromNetwork(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('not connected') ||
      message.includes('no such container') ||
      message.includes('not found')
    );
  }

  isContainerRemovalInProgress(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('removal of container') &&
      message.includes('already in progress')
    );
  }

  isResourceAlreadyExists(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      this.isDockerConflict(error) ||
      this.isDockerForbidden(error) ||
      message.includes('already exists') ||
      message.includes('is already in use')
    );
  }

  isTransientDockerTransportError(error: unknown) {
    const code = this.errorCode(error);
    const message = this.errorMessage(error).toLowerCase();
    return (
      ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(code) ||
      message.includes('socket hang up') ||
      message.includes('connection reset') ||
      message.includes('broken pipe')
    );
  }

  /**
   * Normalizes Docker and transport errors into a single readable message.
   */
  errorMessage(error: unknown) {
    return getErrorMessage(error, 'Unknown Docker error');
  }

  private async observe<T>(
    className: DockerOperationClass,
    operationName: string,
    description: string,
    operation: () => Promise<T>,
  ) {
    const startedAt = Date.now();
    const finish = this.metrics.beginDockerOperation(className, operationName);
    const warning = setTimeout(() => {
      const durationMs = Date.now() - startedAt;
      this.metrics.recordSlowDockerOperation(
        className,
        operationName,
        durationMs,
      );
      this.logger.warn(
        `${description} is still running after ${durationMs}ms (${className}, ${this.transport}).`,
      );
    }, this.slowRequestWarningMs);
    try {
      const result = await operation();
      finish('success');
      return result;
    } catch (error) {
      finish(
        error instanceof DockerLongOperationTimeoutError ? 'timeout' : 'error',
        this.sanitizeDockerError(this.errorMessage(error)),
      );
      throw error;
    } finally {
      clearTimeout(warning);
    }
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
          !this.isTransientDockerTransportError(error)
        ) {
          throw error;
        }

        const errorCode = this.errorCode(error) || 'transport';
        this.metrics.recordDockerRetry(operationName, errorCode);
        this.logger.warn(
          `${description} failed with a transient Docker transport error. Retrying ${attempt}/${maxAttempts - 1}: ${this.errorMessage(error)}`,
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

  private sanitizeDockerError(message: string) {
    return message
      .replace(/\b[0-9a-f]{32,64}\b/gi, '<resource-id>')
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
        '<resource-id>',
      )
      .slice(0, 500);
  }

  private errorCode(error: unknown) {
    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
      ? error.code
      : '';
  }
}
