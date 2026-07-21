import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { NetworkPolicyModule } from '../network-policy/network-policy.module';
import { SettingsModule } from '../settings/settings.module';
import { HealthController } from './health.controller';
import { OcrSidecarHealthService } from './ocr-sidecar-health.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    DockerModule,
    NetworkPolicyModule,
    SettingsModule,
    FeatureFlagsModule,
  ],
  controllers: [HealthController],
  providers: [OcrSidecarHealthService],
})
export class HealthModule {}
