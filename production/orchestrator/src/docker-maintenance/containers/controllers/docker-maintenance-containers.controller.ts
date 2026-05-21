import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerPlatformContainersService } from '../../../docker/containers/services/docker-platform-containers.service';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance/containers')
export class DockerMaintenanceContainersController {
  constructor(private readonly containers: DockerPlatformContainersService) {}

  @Get()
  @ApiOperation({ summary: 'List Docker containers visible to the platform.' })
  @ApiOkResponse({
    schema: {
      example: [
        {
          id: 'f00ba4...',
          shortId: 'f00ba4',
          names: ['rebroid-example-runtime'],
          image: 'redroid/redroid:13.0.0-latest',
          state: 'running',
          status: 'Up 2 minutes',
          managed: true,
          applicationId: 'android-application-id',
          networks: ['rebroid-example'],
        },
      ],
    },
  })
  listContainers() {
    return this.containers.listPlatformContainers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read Docker container details and relationships.' })
  getContainer(@Param('id') id: string) {
    return this.containers.getPlatformContainerDetails(id);
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Read recent Docker logs for a platform container.',
  })
  getContainerLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.containers.getPlatformContainerLogs(
      id,
      tail ? Number(tail) : undefined,
    );
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop a Docker container.' })
  stopContainer(@Param('id') id: string) {
    return this.containers.stopPlatformContainer(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a Docker container.' })
  removeContainer(@Param('id') id: string, @Query('force') force?: string) {
    return this.containers.removePlatformContainer(id, force === 'true');
  }
}
