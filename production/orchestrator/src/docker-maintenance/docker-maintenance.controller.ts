import { Controller, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerService } from '../docker/docker.service';
import { PruneImagesDto } from './dto/prune-images.dto';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance')
export class DockerMaintenanceController {
  constructor(private readonly docker: DockerService) {}

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
  @ApiOperation({ summary: 'Prune stopped containers, unused networks, dangling images, and unused volumes.' })
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
