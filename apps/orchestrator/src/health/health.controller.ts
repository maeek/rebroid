import { Inject, Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  DOCKER_HEALTH,
  type DockerHealthPort,
} from '../docker/contracts/docker-health.port';
import { FirewallAgentClientService } from '../network-policy/services/firewall-agent-client.service';
import { OrchestratorDiagnosticsDto } from './dto/health-response.dto';
import { OcrSidecarHealthService } from './ocr-sidecar-health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(DOCKER_HEALTH)
    private readonly docker: DockerHealthPort,
    private readonly firewallAgent: FirewallAgentClientService,
    private readonly ocrSidecar: OcrSidecarHealthService,
  ) {}

  @Get('health/live')
  live() {
    return { ok: true, service: 'rebroid-orchestrator' };
  }

  @Get('health/ready')
  async ready() {
    const docker = await this.docker.dockerHealth();
    return { ok: docker.ok, services: { docker } };
  }

  @Get('diagnostics')
  @ApiOkResponse({ type: OrchestratorDiagnosticsDto })
  async diagnostics() {
    return this.buildDiagnostics(false);
  }

  @Get('diagnostics/summary')
  @ApiOkResponse({ type: OrchestratorDiagnosticsDto })
  async diagnosticsSummary() {
    return this.buildDiagnostics(true);
  }

  private async buildDiagnostics(summary: boolean) {
    const [docker, display, firewall, ocr] = await Promise.all([
      summary ? this.docker.dockerHealthSummary() : this.docker.dockerHealth(),
      summary
        ? this.docker.displaySidecarSummaryHealth()
        : this.docker.displaySidecarHealth(),
      this.firewallAgent.health().catch((error) => ({
        ok: false,
        status: 'offline',
        message:
          error instanceof Error
            ? error.message
            : 'Firewall agent is unavailable.',
      })),
      this.ocrSidecar.health(),
    ]);
    const runtime = docker.ok
      ? await (summary
          ? this.docker.runtimeSuitabilityHealthSummary()
          : this.docker.runtimeSuitabilityHealth())
      : {
          ok: false,
          status: 'offline' as const,
          message:
            'Docker is unavailable, so runtime suitability cannot be inspected.',
        };

    return {
      ok: docker.ok && runtime.ok && display.ok && firewall.ok && ocr.ok,
      docker: docker.ok,
      runtime: runtime.ok,
      display: display.ok,
      firewall: Boolean(firewall.ok),
      ocr: ocr.ok,
      services: {
        orchestrator: {
          ok: true,
          status: 'healthy',
          message: 'Orchestrator API is responding.',
        },
        docker,
        runtime,
        display,
        firewall,
        ocr,
      },
    };
  }
}
