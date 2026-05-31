import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
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
  }

  async ping() {
    await this.docker.ping();
  }

  async info() {
    return this.docker.info();
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

  /**
   * Normalizes Docker and transport errors into a single readable message.
   */
  errorMessage(error: unknown) {
    return getErrorMessage(error, 'Unknown Docker error');
  }
}
