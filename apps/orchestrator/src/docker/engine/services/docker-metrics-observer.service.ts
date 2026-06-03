import { Injectable, Logger } from '@nestjs/common';
import {
  MetricsService,
  type DockerOperationClass,
} from '../../../metrics/metrics.service';
import { DockerConnection } from './docker-connection.factory';
import { DockerErrorClassifier } from './docker-error-classifier.service';

@Injectable()
export class DockerMetricsObserver {
  private readonly logger = new Logger(DockerMetricsObserver.name);

  constructor(
    private readonly metrics: MetricsService,
    private readonly errors: DockerErrorClassifier,
  ) {}

  configure(
    transport: DockerConnection['transport'],
    options: {
      maxConcurrentReads: number;
      maxConcurrentLongOperations: number;
      slowRequestWarningMs: number;
      longOperationTimeoutMs: number;
      remoteRequestTimeoutMs: number;
    },
  ) {
    this.metrics.configureDocker(transport, options);
  }

  queueDockerOperation(className: DockerOperationClass, delta: number) {
    this.metrics.queueDockerOperation(className, delta);
  }

  recordDockerRetry(operationName: string, errorCode: string) {
    this.metrics.recordDockerRetry(operationName, errorCode);
  }

  async observe<T>(
    className: DockerOperationClass,
    operationName: string,
    description: string,
    transport: DockerConnection['transport'],
    slowRequestWarningMs: number,
    isTimeout: (error: unknown) => boolean,
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
        `${description} is still running after ${durationMs}ms (${className}, ${transport}).`,
      );
    }, slowRequestWarningMs);
    try {
      const result = await operation();
      finish('success');
      return result;
    } catch (error) {
      finish(
        isTimeout(error) ? 'timeout' : 'error',
        this.errors.sanitizeDockerError(this.errors.errorMessage(error)),
      );
      throw error;
    } finally {
      clearTimeout(warning);
    }
  }
}
