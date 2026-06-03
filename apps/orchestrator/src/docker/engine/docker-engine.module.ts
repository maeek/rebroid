import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { MetricsModule } from '../../metrics/metrics.module';
import { DockerEngineService } from '../docker-engine.service';
import { DockerConnectionFactory } from './services/docker-connection.factory';
import { DockerErrorClassifier } from './services/docker-error-classifier.service';
import { DockerMetricsObserver } from './services/docker-metrics-observer.service';
import { DockerOperationExecutor } from './services/docker-operation-executor.service';

@Module({
  imports: [AppConfigModule, MetricsModule],
  providers: [
    DockerConnectionFactory,
    DockerErrorClassifier,
    DockerMetricsObserver,
    DockerOperationExecutor,
    DockerEngineService,
  ],
  exports: [DockerEngineService],
})
export class DockerEngineModule {}
