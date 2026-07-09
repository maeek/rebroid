import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dockerode from 'dockerode';
import { DockerEngineConfigService } from '../config/docker-engine-config.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  DockerConnectionFactory,
  dockerConnectionOptions,
  type DockerConnection,
} from './engine/services/docker-connection.factory';
import { DockerErrorClassifier } from './engine/services/docker-error-classifier.service';
import { DockerMetricsObserver } from './engine/services/docker-metrics-observer.service';
import { DockerOperationExecutor } from './engine/services/docker-operation-executor.service';
import type { DockerEnginePort } from './contracts/docker-engine.port';

export { dockerConnectionOptions };

@Injectable()
export class DockerEngineService implements DockerEnginePort {
  readonly docker: Dockerode;
  readonly streamDocker: Dockerode;
  readonly resourcePrefix: string;
  readonly orchestratorContainerId?: string;
  readonly transport: DockerConnection['transport'];

  constructor(
    config: ConfigService,
    metrics: MetricsService = new MetricsService(),
    private readonly engineConfig: DockerEngineConfigService = new DockerEngineConfigService(
      config,
    ),
    private readonly connections: DockerConnectionFactory = new DockerConnectionFactory(
      engineConfig,
    ),
    private readonly errors: DockerErrorClassifier = new DockerErrorClassifier(),
    private readonly observer: DockerMetricsObserver = new DockerMetricsObserver(
      metrics,
      errors,
    ),
    private readonly executor: DockerOperationExecutor = new DockerOperationExecutor(
      errors,
      observer,
    ),
  ) {
    const connection = this.connections.create();
    this.docker = connection.docker;
    this.streamDocker = connection.streamDocker;
    this.transport = connection.transport;
    this.resourcePrefix = this.engineConfig.resourcePrefix;
    this.orchestratorContainerId = this.engineConfig.orchestratorContainerId;
    const maxConcurrentReads = this.engineConfig.maxConcurrentReads;
    const maxConcurrentLongOperations =
      this.engineConfig.maxConcurrentLongOperations;
    const slowRequestWarningMs = this.engineConfig.slowRequestWarningMs;
    const longOperationTimeoutMs = this.engineConfig.longOperationTimeoutMs;
    this.executor.configure({
      transport: this.transport,
      maxConcurrentReads,
      maxConcurrentLongOperations,
      slowRequestWarningMs,
      longOperationTimeoutMs,
      remoteRequestTimeoutMs: connection.remoteRequestTimeoutMs,
    });
  }

  ping() {
    return this.read(() => this.docker.ping(), 'Ping Docker API');
  }

  info() {
    return this.read(() => this.docker.info(), 'Inspect Docker runtime info');
  }

  get hasPendingMutations() {
    return this.executor.hasPendingMutations;
  }

  get hasPendingDockerWork() {
    return this.executor.hasPendingDockerWork;
  }

  read<T>(operation: () => Promise<T>, description = 'Docker read') {
    return this.executor.read(operation, description);
  }

  coalesceRead<T>(
    key: string,
    operation: () => Promise<T>,
    description = 'Docker read',
  ) {
    return this.executor.coalesceRead(key, operation, description);
  }

  mutate<T>(operation: () => Promise<T>, description = 'Docker mutation') {
    return this.executor.mutate(operation, description);
  }

  longOperation<T>(
    operationName: string,
    description: string,
    operation: (docker: Dockerode, signal: AbortSignal) => Promise<T>,
    timeoutMs?: number,
  ) {
    return this.executor.longOperation(
      operationName,
      description,
      this.streamDocker,
      operation,
      timeoutMs,
    );
  }

  labels(applicationId: string, component: string) {
    return {
      'com.rebroid.managed': 'true',
      'com.rebroid.application-id': applicationId,
      'com.rebroid.component': component,
      'com.rebroid.resource-prefix': this.resourcePrefix,
    };
  }

  isDockerConflict(error: unknown) {
    return this.errors.isDockerConflict(error);
  }

  isDockerForbidden(error: unknown) {
    return this.errors.isDockerForbidden(error);
  }

  isDockerNotFound(error: unknown) {
    return this.errors.isDockerNotFound(error);
  }

  isDockerNotModified(error: unknown) {
    return this.errors.isDockerNotModified(error);
  }

  isContainerAlreadyConnectedToNetwork(error: unknown) {
    return this.errors.isContainerAlreadyConnectedToNetwork(error);
  }

  isContainerAlreadyDisconnectedFromNetwork(error: unknown) {
    return this.errors.isContainerAlreadyDisconnectedFromNetwork(error);
  }

  isContainerRemovalInProgress(error: unknown) {
    return this.errors.isContainerRemovalInProgress(error);
  }

  isResourceAlreadyExists(error: unknown) {
    return this.errors.isResourceAlreadyExists(error);
  }

  isTransientDockerTransportError(error: unknown) {
    return this.errors.isTransientDockerTransportError(error);
  }

  errorMessage(error: unknown) {
    return this.errors.errorMessage(error);
  }
}
