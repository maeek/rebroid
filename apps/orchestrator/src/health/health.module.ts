import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { NetworkPolicyModule } from '../network-policy/network-policy.module';
import { SettingsModule } from '../settings/settings.module';
import { HealthController } from './health.controller';
import { OcrSidecarHealthService } from './ocr-sidecar-health.service';

@Module({
  imports: [DockerModule, NetworkPolicyModule, SettingsModule],
  controllers: [HealthController],
  providers: [OcrSidecarHealthService],
})
export class HealthModule {}
