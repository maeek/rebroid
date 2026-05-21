import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DockerPlatformImagesService } from '../../../docker/images/services/docker-platform-images.service';

@ApiTags('docker-maintenance')
@Controller('docker-maintenance/images')
export class DockerMaintenanceImagesController {
  constructor(private readonly images: DockerPlatformImagesService) {}

  @Get()
  @ApiOperation({ summary: 'List Docker images visible to the platform.' })
  listImages() {
    return this.images.listPlatformImages();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read Docker image details and relationships.' })
  getImage(@Param('id') id: string) {
    return this.images.getPlatformImageDetails(decodeURIComponent(id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a Docker image by encoded id or name.' })
  removeImage(@Param('id') id: string, @Query('force') force?: string) {
    return this.images.removePlatformImage(
      decodeURIComponent(id),
      force === 'true',
    );
  }
}
