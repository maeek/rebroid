import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerService } from '../docker/docker.service';
import { PruneImagesDto } from './dto/prune-images.dto';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance')
export class DockerMaintenanceController {
  constructor(private readonly docker: DockerService) {}

  @Get('containers')
  @ApiOperation({ summary: 'List Docker containers visible to the platform.' })
  @ApiOkResponse({
    schema: {
      example: [
        {
          id: 'f00ba4...',
          shortId: 'f00ba4',
          names: ['sma-example-runtime'],
          image: 'redroid/redroid:13.0.0-latest',
          state: 'running',
          status: 'Up 2 minutes',
          managed: true,
          applicationId: 'android-application-id',
          networks: ['sma-example'],
        },
      ],
    },
  })
  listContainers() {
    return this.docker.listPlatformContainers();
  }

  @Post('containers/:id/stop')
  @ApiOperation({ summary: 'Stop a Docker container.' })
  stopContainer(@Param('id') id: string) {
    return this.docker.stopPlatformContainer(id);
  }

  @Delete('containers/:id')
  @ApiOperation({ summary: 'Remove a Docker container.' })
  removeContainer(@Param('id') id: string) {
    return this.docker.removePlatformContainer(id);
  }

  @Get('images')
  @ApiOperation({ summary: 'List Docker images visible to the platform.' })
  listImages() {
    return this.docker.listPlatformImages();
  }

  @Delete('images/:id')
  @ApiOperation({ summary: 'Remove a Docker image by encoded id or name.' })
  removeImage(@Param('id') id: string, @Query('force') force?: string) {
    return this.docker.removePlatformImage(
      decodeURIComponent(id),
      force === 'true',
    );
  }

  @Get('networks')
  @ApiOperation({ summary: 'List Docker networks visible to the platform.' })
  listNetworks() {
    return this.docker.listPlatformNetworks();
  }

  @Delete('networks/:id')
  @ApiOperation({ summary: 'Remove a Docker network by id.' })
  removeNetwork(@Param('id') id: string) {
    return this.docker.removePlatformNetwork(id);
  }

  @Post('prune/images')
  @ApiOperation({ summary: 'Prune unused images.' })
  pruneImages(@Query() query: PruneImagesDto) {
    return this.docker.pruneImages(query.danglingOnly ?? true);
  }

  @Post('prune/containers')
  @ApiOperation({ summary: 'Prune stopped containers.' })
  pruneContainers() {
    return this.docker.pruneContainers();
  }

  @Post('prune/networks')
  @ApiOperation({ summary: 'Prune unused networks.' })
  pruneNetworks() {
    return this.docker.pruneNetworks();
  }

  @Post('prune/volumes')
  @ApiOperation({ summary: 'Prune unused volumes.' })
  pruneVolumes() {
    return this.docker.pruneVolumes();
  }

  @Post('prune/all')
  @ApiOperation({
    summary:
      'Prune stopped containers, unused networks, dangling images, and unused volumes.',
  })
  async pruneAll() {
    const [containers, networks, images, volumes] = await Promise.all([
      this.docker.pruneContainers(),
      this.docker.pruneNetworks(),
      this.docker.pruneImages(true),
      this.docker.pruneVolumes(),
    ]);

    return {
      containers,
      networks,
      images,
      volumes,
    };
  }
}
