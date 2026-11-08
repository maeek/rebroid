import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { MetricsModule } from '../../metrics/metrics.module';
import { SettingsModule } from '../../settings/settings.module';
import { DockerOperationSettingsController } from './controllers/docker-operation-settings.controller';
import { DockerOperationSettingsService } from './services/docker-operation-settings.service';
import { DockerEngineService } from '../docker-engine.service';
import { DockerConnectionFactory } from './services/docker-connection.factory';
import { DockerErrorClassifier } from './services/docker-error-classifier.service';
import { DockerMetricsObserver } from './services/docker-metrics-observer.service';
import { DockerOperationExecutor } from './services/docker-operation-executor.service';
import { DOCKER_ENGINE } from '../contracts/docker-engine.port';

@Module({
  imports: [AppConfigModule, MetricsModule, SettingsModule],
  controllers: [DockerOperationSettingsController],
  providers: [
    DockerConnectionFactory,
    DockerErrorClassifier,
    DockerMetricsObserver,
    DockerOperationExecutor,
    DockerEngineService,
    DockerOperationSettingsService,
    { provide: DOCKER_ENGINE, useExisting: DockerEngineService },
  ],
  exports: [DockerEngineService, DOCKER_ENGINE],
})
export class DockerEngineModule {}
