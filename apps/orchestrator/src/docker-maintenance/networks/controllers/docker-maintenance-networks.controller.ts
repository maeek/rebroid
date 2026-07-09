import { Inject, Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DOCKER_PLATFORM_NETWORKS,
  type DockerPlatformNetworksPort,
} from '../../../docker/contracts/docker-platform-networks.port';
import {
  DockerPlatformNetworkDetailsDto,
  DockerPlatformNetworkDto,
  DockerPlatformRemovalResponseDto,
} from '../../dto/docker-maintenance-response.dto';

@ApiTags('platform-docker')
@Controller('platform/docker/networks')
export class DockerMaintenanceNetworksController {
  constructor(
    @Inject(DOCKER_PLATFORM_NETWORKS)
    private readonly networks: DockerPlatformNetworksPort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Docker networks visible to the platform.' })
  @ApiOkResponse({ type: [DockerPlatformNetworkDto] })
  listNetworks() {
    return this.networks.listPlatformNetworks();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read Docker network details and relationships.' })
  @ApiOkResponse({ type: DockerPlatformNetworkDetailsDto })
  getNetwork(@Param('id') id: string) {
    return this.networks.getPlatformNetworkDetails(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a Docker network by id.' })
  @ApiOkResponse({ type: DockerPlatformRemovalResponseDto })
  removeNetwork(@Param('id') id: string) {
    return this.networks.removePlatformNetwork(id);
  }
}
