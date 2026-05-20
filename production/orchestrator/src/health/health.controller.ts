import { Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DockerHealthService } from '../docker/docker-health.service';

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
          scrcpy: {
            ok: true,
            status: 'healthy',
            message: 'ws-scrcpy sidecar is running.',
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
    const scrcpy = docker.ok
      ? await this.docker.wsScrcpyHealth()
      : {
          ok: false,
          status: 'offline' as const,
          message: 'Docker is unavailable, so ws-scrcpy cannot be inspected.',
        };

    return {
      ok: docker.ok && runtime.ok && scrcpy.ok,
      docker: docker.ok,
      runtime: runtime.ok,
      scrcpy: scrcpy.ok,
      services: {
        orchestrator: {
          ok: true,
          status: 'healthy',
          message: 'Orchestrator API is responding.',
        },
        docker,
        runtime,
        scrcpy,
      },
    };
  }

  @Post('scrcpy/repair')
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        status: 'healthy',
        message: 'ws-scrcpy sidecar is running.',
      },
    },
  })
  async repairScrcpy() {
    await this.docker.repairWsScrcpySidecar();
    return this.docker.wsScrcpyHealth();
  }
}
