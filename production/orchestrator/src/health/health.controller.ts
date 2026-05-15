import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DockerService } from '../docker/docker.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly docker: DockerService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        docker: true,
      },
    },
  })
  async health() {
    await this.docker.ping();
    return {
      ok: true,
      docker: true,
    };
  }
}
