import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DockerHealthService } from '../docker/health/services/docker-health.service';
import { FirewallAgentClientService } from '../network-policy/services/firewall-agent-client.service';
import { OrchestratorDiagnosticsDto } from './dto/health-response.dto';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly docker: DockerHealthService,
    private readonly firewallAgent: FirewallAgentClientService,
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
    const [docker, display, firewall] = await Promise.all([
      this.docker.dockerHealth(),
      this.docker.displaySidecarHealth(),
      this.firewallAgent.health().catch((error) => ({
        ok: false,
        status: 'offline',
        message:
          error instanceof Error
            ? error.message
            : 'Firewall agent is unavailable.',
      })),
    ]);
    const runtime = docker.ok
      ? await this.docker.runtimeSuitabilityHealth()
      : {
          ok: false,
          status: 'offline' as const,
          message:
            'Docker is unavailable, so runtime suitability cannot be inspected.',
        };

    return {
      ok: docker.ok && runtime.ok && display.ok && firewall.ok,
      docker: docker.ok,
      runtime: runtime.ok,
      display: display.ok,
      firewall: Boolean(firewall.ok),
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
      },
    };
  }
}
