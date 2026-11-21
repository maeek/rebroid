import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { NetworkPolicyModule } from '../network-policy/network-policy.module';
import { OcrSidecarModule } from '../ocr-sidecar/ocr-sidecar.module';
import { SettingsModule } from '../settings/settings.module';
import { OrchestratorDiagnosticsService } from './orchestrator-diagnostics.service';
import { HealthController } from './health.controller';
import { OcrSidecarHealthService } from './ocr-sidecar-health.service';

@Module({
  imports: [
    DockerModule,
    NetworkPolicyModule,
    OcrSidecarModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [OcrSidecarHealthService, OrchestratorDiagnosticsService],
})
export class HealthModule {}
