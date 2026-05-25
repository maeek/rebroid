import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DockerHealthService } from '../docker/health/services/docker-health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly docker: DockerHealthService) {}

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

    return {
      ok: docker.ok && runtime.ok && display.ok,
      docker: docker.ok,
      runtime: runtime.ok,
      display: display.ok,
      services: {
        orchestrator: {
          ok: true,
          status: 'healthy',
          message: 'Orchestrator API is responding.',
        },
        docker,
        runtime,
        display,
      },
    };
  }
}
