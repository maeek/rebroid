import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { setTimeout as delay } from 'node:timers/promises';
import pLimit from 'p-limit';
import { getErrorMessage } from '../common/error-message';
import { hasDockerStatusCode } from './utils/docker-engine.utils';

const dockerConnectionOptions = (
  dockerHost: string | undefined,
  socketPath: string,
  timeout: number,
  connectionTimeout: number,
): Dockerode.DockerOptions => {
  const requestOptions = { timeout, connectionTimeout };
  const normalizedHost = dockerHost?.trim();
  if (!normalizedHost) {
    return { socketPath, ...requestOptions };
  }

  if (normalizedHost.startsWith('unix://')) {
    const url = new URL(normalizedHost);
    return { socketPath: decodeURIComponent(url.pathname), ...requestOptions };
  }

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
      protocol,
      host: url.hostname,
      port: url.port ? Number(url.port) : undefined,
      ...requestOptions,
    };
  }

  return { host: normalizedHost, ...requestOptions };
};

@Injectable()
export class DockerEngineService {
  private readonly logger = new Logger(DockerEngineService.name);
  private readonly limitRead: ReturnType<typeof pLimit>;
  private mutationQueue = Promise.resolve();
  private pendingMutations = 0;
  readonly docker: Dockerode;
  readonly resourcePrefix: string;
  readonly orchestratorContainerId?: string;

  constructor(private readonly config: ConfigService) {
    const dockerHost = process.env.DOCKER_HOST;
    this.docker = new Dockerode(
      dockerConnectionOptions(
        dockerHost,
        this.config.getOrThrow<string>('app.docker.socketPath'),
        this.config.getOrThrow<number>('app.docker.requestTimeoutMs'),
        this.config.getOrThrow<number>('app.docker.connectionTimeoutMs'),
      ),
    );
    this.resourcePrefix = this.config.getOrThrow<string>(
      'app.docker.resourcePrefix',
    );
    this.orchestratorContainerId = this.config.get<string>(
      'app.docker.orchestratorContainerId',
    );
    this.limitRead = pLimit(
      this.config.getOrThrow<number>('app.docker.maxConcurrentReads'),
    );
  }

  async ping() {
    await this.read(() => this.docker.ping());
  }

  async info() {
    return this.read(() => this.docker.info());
  }

  get hasPendingMutations() {
    return this.pendingMutations > 0;
  }

  async read<T>(operation: () => Promise<T>, description = 'Docker read') {
    return this.limitRead(() => this.retryTransient(operation, description));
  }

  async mutate<T>(
    operation: () => Promise<T>,
    description = 'Docker mutation',
  ) {
    this.pendingMutations += 1;
    // A socket reset does not prove that Docker rejected a mutation. Replaying
    // start, stop, remove, or network connect requests can duplicate side
    // effects and amplify daemon stalls.
    const queued = this.mutationQueue.then(operation, operation);
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
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : '';
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

  private async retryTransient<T>(
    operation: () => Promise<T>,
    description: string,
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

        this.logger.warn(
          `${description} failed with a transient Docker transport error. Retrying ${attempt}/${maxAttempts - 1}: ${this.errorMessage(error)}`,
        );
        await delay(250 * attempt);
      }
    }

    throw new Error(`${description} failed.`);
  }
}
