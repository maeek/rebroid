import { Controller, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerPlatformPruneService } from '../../../docker/prune/services/docker-platform-prune.service';
import {
  DockerPruneAllResponseDto,
  DockerPruneResponseDto,
} from '../../dto/docker-maintenance-response.dto';
import { PruneImagesDto } from '../dto/prune-images.dto';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance/prune')
export class DockerMaintenancePruneController {
  constructor(private readonly prune: DockerPlatformPruneService) {}

  @Post('images')
  @ApiOperation({ summary: 'Prune unused images.' })
  @ApiCreatedResponse({ type: DockerPruneResponseDto })
  pruneImages(@Query() query: PruneImagesDto) {
    return this.prune.pruneImages(query.danglingOnly ?? true);
  }

  @Post('containers')
  @ApiOperation({ summary: 'Prune stopped containers.' })
  @ApiCreatedResponse({ type: DockerPruneResponseDto })
  pruneContainers() {
    return this.prune.pruneContainers();
  }

  @Post('networks')
  @ApiOperation({ summary: 'Prune unused networks.' })
  @ApiCreatedResponse({ type: DockerPruneResponseDto })
  pruneNetworks() {
    return this.prune.pruneNetworks();
  }

  @Post('volumes')
  @ApiOperation({ summary: 'Prune unused volumes.' })
  @ApiCreatedResponse({ type: DockerPruneResponseDto })
  pruneVolumes() {
    return this.prune.pruneVolumes();
  }

  @Post('all')
  @ApiOperation({
    summary:
      'Prune stopped containers, unused networks, dangling images, and unused volumes.',
  })
  @ApiCreatedResponse({ type: DockerPruneAllResponseDto })
  async pruneAll() {
    const containers = await this.prune.pruneContainers();
    const networks = await this.prune.pruneNetworks();
    const images = await this.prune.pruneImages(true);
    const volumes = await this.prune.pruneVolumes();

    return {
      containers,
      networks,
      images,
      volumes,
    };
  }
}
