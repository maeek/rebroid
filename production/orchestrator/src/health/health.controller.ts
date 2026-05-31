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
