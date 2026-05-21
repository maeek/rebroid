import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerPlatformNetworksService } from '../../../docker/networks/services/docker-platform-networks.service';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance/networks')
export class DockerMaintenanceNetworksController {
  constructor(private readonly networks: DockerPlatformNetworksService) {}

  @Get()
  @ApiOperation({ summary: 'List Docker networks visible to the platform.' })
  listNetworks() {
    return this.networks.listPlatformNetworks();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read Docker network details and relationships.' })
  getNetwork(@Param('id') id: string) {
    return this.networks.getPlatformNetworkDetails(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a Docker network by id.' })
  removeNetwork(@Param('id') id: string) {
    return this.networks.removePlatformNetwork(id);
  }
}
