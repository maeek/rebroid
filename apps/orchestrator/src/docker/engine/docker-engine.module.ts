import { Module } from '@nestjs/common';
import { MetricsModule } from '../../metrics/metrics.module';
import { DockerEngineService } from '../docker-engine.service';

@Module({
  imports: [MetricsModule],
  providers: [DockerEngineService],
  exports: [DockerEngineService],
})
export class DockerEngineModule {}
