import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceHealthDto } from '../../../health/dto/health-response.dto';
import { DockerSidecarAdminSessionDto } from '../dto/docker-sidecar-response.dto';
import { DockerSidecarService } from '../services/docker-sidecar.service';

@ApiTags('docker-sidecar')
@Controller('docker/sidecar')
export class DockerSidecarController {
  constructor(private readonly sidecar: DockerSidecarService) {}

  @Get('health')
  @ApiOperation({ summary: 'Read display sidecar health.' })
  @ApiOkResponse({ type: ServiceHealthDto })
  health() {
    return this.sidecar.health();
  }

  @Post('repair')
  @ApiOperation({ summary: 'Restart or create the display sidecar.' })
  @ApiOkResponse({ type: ServiceHealthDto })
  async repair() {
    await this.sidecar.repair();
    return this.sidecar.health();
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'List display sidecar sessions for administration.',
  })
  @ApiOkResponse({ type: [DockerSidecarAdminSessionDto] })
  listSessions() {
    return this.sidecar.listDisplaySessions();
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Release one display sidecar session.' })
  @ApiOkResponse({ type: DockerSidecarAdminSessionDto })
  releaseSession(@Param('id') id: string) {
    return this.sidecar.releaseDisplaySession(id);
  }
}
