import { Controller, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerPlatformPruneService } from '../../../docker/prune/services/docker-platform-prune.service';
import { PruneImagesDto } from '../dto/prune-images.dto';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance/prune')
export class DockerMaintenancePruneController {
  constructor(private readonly prune: DockerPlatformPruneService) {}

  @Post('images')
  @ApiOperation({ summary: 'Prune unused images.' })
  pruneImages(@Query() query: PruneImagesDto) {
    return this.prune.pruneImages(query.danglingOnly ?? true);
  }

  @Post('containers')
  @ApiOperation({ summary: 'Prune stopped containers.' })
  pruneContainers() {
    return this.prune.pruneContainers();
  }

  @Post('networks')
  @ApiOperation({ summary: 'Prune unused networks.' })
  pruneNetworks() {
    return this.prune.pruneNetworks();
  }

  @Post('volumes')
  @ApiOperation({ summary: 'Prune unused volumes.' })
  pruneVolumes() {
    return this.prune.pruneVolumes();
  }

  @Post('all')
  @ApiOperation({
    summary:
      'Prune stopped containers, unused networks, dangling images, and unused volumes.',
  })
  async pruneAll() {
    const [containers, networks, images, volumes] = await Promise.all([
      this.prune.pruneContainers(),
      this.prune.pruneNetworks(),
      this.prune.pruneImages(true),
      this.prune.pruneVolumes(),
    ]);

    return {
      containers,
      networks,
      images,
      volumes,
    };
  }
}
