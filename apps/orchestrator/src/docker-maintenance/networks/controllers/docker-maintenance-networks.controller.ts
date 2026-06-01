import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerPlatformNetworksService } from '../../../docker/networks/services/docker-platform-networks.service';
import {
  DockerPlatformNetworkDetailsDto,
  DockerPlatformNetworkDto,
  DockerPlatformRemovalResponseDto,
} from '../../dto/docker-maintenance-response.dto';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance/networks')
export class DockerMaintenanceNetworksController {
  constructor(private readonly networks: DockerPlatformNetworksService) {}

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
