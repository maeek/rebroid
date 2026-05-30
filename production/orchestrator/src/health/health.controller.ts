import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DockerHealthService } from '../docker/health/services/docker-health.service';
import { FirewallAgentClientService } from '../network-policy/services/firewall-agent-client.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly docker: DockerHealthService,
    private readonly firewallAgent: FirewallAgentClientService,
  ) {}

  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        services: {
          orchestrator: {
            ok: true,
            status: 'healthy',
            message: 'Orchestrator API is responding.',
          },
          docker: {
            ok: true,
            status: 'healthy',
            message: 'Docker API is reachable.',
          },
          runtime: {
            ok: true,
            status: 'healthy',
            message:
              'Container runtime is suitable for privileged app containers.',
          },
          display: {
            ok: true,
            status: 'healthy',
            message: 'Display sidecar is running.',
          },
        },
      },
    },
  })
  async health() {
    const docker = await this.docker.dockerHealth();
    const runtime = docker.ok
      ? await this.docker.runtimeSuitabilityHealth()
      : {
          ok: false,
          status: 'offline' as const,
          message:
            'Docker is unavailable, so runtime suitability cannot be inspected.',
        };
    const display = docker.ok
      ? await this.docker.displaySidecarHealth()
      : {
          ok: false,
          status: 'offline' as const,
          message:
            'Docker is unavailable, so the display sidecar cannot be inspected.',
        };
    const firewall = await this.firewallAgent.health().catch((error) => ({
      ok: false,
      status: 'offline',
      message:
        error instanceof Error
          ? error.message
          : 'Firewall agent is unavailable.',
    }));

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
