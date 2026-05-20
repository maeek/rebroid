import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DockerRuntimeService } from '../docker/docker-runtime.service';
import { SettingsService } from '../settings/settings.service';
import { PullContainerImageDto } from './dto/pull-container-image.dto';
import { RemoveContainerImageDto } from './dto/remove-container-image.dto';

@ApiTags('container-images')
@Controller('container-images')
export class ContainerImagesController {
  constructor(
    private readonly docker: DockerRuntimeService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List images available in the container engine.' })
  @ApiOkResponse({ description: 'Container engine image summaries.' })
  list() {
    return this.docker.listImages();
  }

  @Post('pull')
  @ApiOperation({ summary: 'Pull or update an image.' })
  @ApiCreatedResponse({
    schema: {
      example: {
        image: 'redroid/redroid:13.0.0-latest',
        status: 'pulled',
      },
    },
  })
  async pull(@Body() dto: PullContainerImageDto) {
    const settings = await this.settings.getSettings();
    const image = this.resolveContainerImage(
      dto.image,
      settings.dockerImageRegistry,
    );
    await this.docker.pullImage(image);
    return {
      image,
      status: 'pulled',
    };
  }

  @Delete(':image')
  @ApiOperation({ summary: 'Remove an image by name or id.' })
  @ApiParam({
    name: 'image',
    description:
      'URL-encoded image name or id. Example: redroid%2Fredroid%3A13.0.0-latest',
  })
  remove(
    @Param('image') image: string,
    @Query() query: RemoveContainerImageDto,
  ) {
    return this.docker.removeImage(
      decodeURIComponent(image),
      query.force ?? false,
    );
  }

  private resolveContainerImage(image: string, registry: string | null) {
    const trimmedImage = image.trim();
    if (!registry) {
      return trimmedImage;
    }

    const firstSegment = trimmedImage.split('/')[0] ?? '';
    const hasExplicitRegistry =
      firstSegment === 'localhost' ||
      firstSegment.includes('.') ||
      firstSegment.includes(':');

    return hasExplicitRegistry
      ? trimmedImage
      : `${registry.replace(/\/+$/, '')}/${trimmedImage}`;
  }
}
