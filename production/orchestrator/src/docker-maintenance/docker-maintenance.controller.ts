import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerAdminService } from './docker-admin.service';
import { PruneImagesDto } from './dto/prune-images.dto';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance')
export class DockerMaintenanceController {
  constructor(private readonly dockerAdmin: DockerAdminService) {}

  @Get('containers')
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
    return this.dockerAdmin.listContainers();
  }

  @Get('containers/:id')
  @ApiOperation({ summary: 'Read Docker container details and relationships.' })
  getContainer(@Param('id') id: string) {
    return this.dockerAdmin.getContainer(id);
  }

  @Get('containers/:id/logs')
  @ApiOperation({
    summary: 'Read recent Docker logs for a platform container.',
  })
  getContainerLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.dockerAdmin.getContainerLogs(
      id,
      tail ? Number(tail) : undefined,
    );
  }

  @Post('containers/:id/stop')
  @ApiOperation({ summary: 'Stop a Docker container.' })
  stopContainer(@Param('id') id: string) {
    return this.dockerAdmin.stopContainer(id);
  }

  @Delete('containers/:id')
  @ApiOperation({ summary: 'Remove a Docker container.' })
  removeContainer(@Param('id') id: string, @Query('force') force?: string) {
    return this.dockerAdmin.removeContainer(id, force === 'true');
  }

  @Get('images')
  @ApiOperation({ summary: 'List Docker images visible to the platform.' })
  listImages() {
    return this.dockerAdmin.listImages();
  }

  @Get('images/:id')
  @ApiOperation({ summary: 'Read Docker image details and relationships.' })
  getImage(@Param('id') id: string) {
    return this.dockerAdmin.getImage(id);
  }

  @Delete('images/:id')
  @ApiOperation({ summary: 'Remove a Docker image by encoded id or name.' })
  removeImage(@Param('id') id: string, @Query('force') force?: string) {
    return this.dockerAdmin.removeImage(id, force === 'true');
  }

  @Get('networks')
  @ApiOperation({ summary: 'List Docker networks visible to the platform.' })
  listNetworks() {
    return this.dockerAdmin.listNetworks();
  }

  @Get('networks/:id')
  @ApiOperation({ summary: 'Read Docker network details and relationships.' })
  getNetwork(@Param('id') id: string) {
    return this.dockerAdmin.getNetwork(id);
  }

  @Delete('networks/:id')
  @ApiOperation({ summary: 'Remove a Docker network by id.' })
  removeNetwork(@Param('id') id: string) {
    return this.dockerAdmin.removeNetwork(id);
  }

  @Post('prune/images')
  @ApiOperation({ summary: 'Prune unused images.' })
  pruneImages(@Query() query: PruneImagesDto) {
    return this.dockerAdmin.pruneImages(query);
  }

  @Post('prune/containers')
  @ApiOperation({ summary: 'Prune stopped containers.' })
  pruneContainers() {
    return this.dockerAdmin.pruneContainers();
  }

  @Post('prune/networks')
  @ApiOperation({ summary: 'Prune unused networks.' })
  pruneNetworks() {
    return this.dockerAdmin.pruneNetworks();
  }

  @Post('prune/volumes')
  @ApiOperation({ summary: 'Prune unused volumes.' })
  pruneVolumes() {
    return this.dockerAdmin.pruneVolumes();
  }

  @Post('prune/all')
  @ApiOperation({
    summary:
      'Prune stopped containers, unused networks, dangling images, and unused volumes.',
  })
  async pruneAll() {
    return this.dockerAdmin.pruneAll();
  }
}
