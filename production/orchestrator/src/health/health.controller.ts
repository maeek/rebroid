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
    const scrcpy = docker.ok
      ? await this.docker.wsScrcpyHealth()
      : {
          ok: false,
          status: 'offline' as const,
          message: 'Docker is unavailable, so ws-scrcpy cannot be inspected.',
        };

    return {
      ok: docker.ok && scrcpy.ok,
      docker: docker.ok,
      scrcpy: scrcpy.ok,
      services: {
        orchestrator: {
          ok: true,
          status: 'healthy',
          message: 'Orchestrator API is responding.',
        },
        docker,
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
