import {
  Inject,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DOCKER_PLATFORM_CONTAINERS,
  type DockerPlatformContainersPort,
} from '../../../docker/contracts/docker-platform-containers.port';
import {
  DockerPlatformContainerDetailsDto,
  DockerPlatformContainerDto,
  DockerPlatformContainerLogDto,
  DockerPlatformContainerStatsDto,
  DockerPlatformRemovalResponseDto,
  DockerPlatformStopResponseDto,
} from '../../dto/docker-maintenance-response.dto';
import { DockerMaintenanceContainerQueryService } from '../services/docker-maintenance-container-query.service';

@ApiTags('platform-docker')
@Controller('platform/docker/containers')
export class DockerMaintenanceContainersController {
  constructor(
    @Inject(DOCKER_PLATFORM_CONTAINERS)
    private readonly containers: DockerPlatformContainersPort,
    private readonly queries: DockerMaintenanceContainerQueryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Docker containers visible to the platform.' })
  @ApiOkResponse({ type: [DockerPlatformContainerDto] })
  async listContainers() {
    return this.queries.listContainers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read Docker container details and relationships.' })
  @ApiOkResponse({ type: DockerPlatformContainerDetailsDto })
  async getContainer(@Param('id') id: string) {
    return this.queries.getContainer(id);
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Read recent Docker logs for a platform container.',
  })
  @ApiOkResponse({ type: DockerPlatformContainerLogDto })
  getContainerLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.containers.getPlatformContainerLogs(
      id,
      tail ? Number(tail) : undefined,
    );
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Read live Docker stats for a platform container.' })
  @ApiOkResponse({ type: DockerPlatformContainerStatsDto })
  getContainerStats(@Param('id') id: string) {
    return this.containers.getPlatformContainerStats(id);
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop a Docker container.' })
  @ApiOkResponse({ type: DockerPlatformStopResponseDto })
  stopContainer(@Param('id') id: string) {
    return this.containers.stopPlatformContainer(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a Docker container.' })
  @ApiOkResponse({ type: DockerPlatformRemovalResponseDto })
  removeContainer(@Param('id') id: string, @Query('force') force?: string) {
    return this.containers.removePlatformContainer(id, force === 'true');
  }
}
