import { Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerSidecarService } from '../services/docker-sidecar.service';

@ApiTags('docker-sidecar')
@Controller('docker/sidecar')
export class DockerSidecarController {
  constructor(private readonly sidecar: DockerSidecarService) {}

  @Get('health')
  @ApiOperation({ summary: 'Read ws-scrcpy sidecar health.' })
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        status: 'healthy',
        message: 'ws-scrcpy sidecar is running.',
      },
    },
  })
  health() {
    return this.sidecar.health();
  }

  @Post('repair')
  @ApiOperation({ summary: 'Restart or create the ws-scrcpy sidecar.' })
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        status: 'healthy',
        message: 'ws-scrcpy sidecar is running.',
      },
    },
  })
  async repair() {
    await this.sidecar.repair();
    return this.sidecar.health();
  }
}
