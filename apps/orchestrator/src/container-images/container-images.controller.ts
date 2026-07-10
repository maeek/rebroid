import {
  Inject,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  DOCKER_IMAGE_RUNTIME,
  type DockerImageRuntimePort,
} from '../docker/contracts/docker-image-runtime.port';
import { SettingsService } from '../settings/settings.service';
import {
  CreateContainerImageRecipeDto,
  StartContainerImageBuildDto,
  UpdateContainerImageRecipeDto,
} from './dto/container-image-build.dto';
import { PullContainerImageDto } from './dto/pull-container-image.dto';
import { RemoveContainerImageDto } from './dto/remove-container-image.dto';
import { UploadContainerImageContextFileDto } from './dto/upload-container-image-context-file.dto';
import { ContainerImageBuildContextFile } from './entities/container-image-build-context-file.entity';
import { ContainerImageBuildJob } from './entities/container-image-build-job.entity';
import { ContainerImageBuildRecipe } from './entities/container-image-build-recipe.entity';
import { ContainerImageBuilderService } from './services/container-image-builder.service';
import { ContainerImageBuildContextService } from './services/container-image-build-context.service';
import { ContainerImageRecipeService } from './services/container-image-recipe.service';
import {
  GappsBuildPresetsResponseDto,
  StartGappsBuildDto,
} from './dto/gapps-build.dto';
import { ContainerImageGappsBuilderService } from './services/container-image-gapps-builder.service';
import { ContainerImageGappsPresetService } from './services/container-image-gapps-preset.service';
import { resolveContainerImage } from '@rebroid/application-core/container-image';

@ApiTags('platform-container-images')
@Controller('platform/container-images')
export class ContainerImagesController {
  constructor(
    @Inject(DOCKER_IMAGE_RUNTIME)
    private readonly images: DockerImageRuntimePort,
    private readonly settings: SettingsService,
    private readonly recipes: ContainerImageRecipeService,
    private readonly buildContext: ContainerImageBuildContextService,
    private readonly builder: ContainerImageBuilderService,
    private readonly gappsBuilder: ContainerImageGappsBuilderService,
    private readonly gappsPresets: ContainerImageGappsPresetService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List images available in the container engine.' })
  @ApiOkResponse({ description: 'Container engine image summaries.' })
  list() {
    return this.images.listImages();
  }

  @Post('pull')
  @ApiOperation({ summary: 'Pull or update an image.' })
  @ApiCreatedResponse({
    schema: {
      example: {
        image: 'redroid/redroid:14.0.0-latest',
        status: 'pulled',
      },
    },
  })
  async pull(@Body() dto: PullContainerImageDto) {
    const settings = await this.settings.getSettings();
    const image = resolveContainerImage(
      dto.image,
      settings.dockerImageRegistry,
    );
    await this.images.pullImage(image);
    return {
      image,
      status: 'pulled',
    };
  }

  @Get('build-context')
  @ApiOperation({ summary: 'List uploaded image build context files.' })
  @ApiOkResponse({ type: ContainerImageBuildContextFile, isArray: true })
  listBuildContextFiles() {
    return this.buildContext.listFiles();
  }

  @Post('build-context')
  @ApiOperation({ summary: 'Upload one image build context file.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: ContainerImageBuildContextFile })
  uploadBuildContextFile(
    @Req() request: FastifyRequest,
    @Query() query: UploadContainerImageContextFileDto,
  ) {
    return this.buildContext.consumeUpload(request.raw, query.contextPath);
  }

  @Delete('build-context/:id')
  @ApiOperation({ summary: 'Remove one uploaded image build context file.' })
  removeBuildContextFile(@Param('id') id: string) {
    return this.buildContext.removeFile(id);
  }

  @Get('recipes')
  @ApiOperation({ summary: 'List saved image build recipes.' })
  @ApiOkResponse({ type: ContainerImageBuildRecipe, isArray: true })
  listRecipes() {
    return this.recipes.list();
  }

  @Post('recipes')
  @ApiOperation({ summary: 'Create an image build recipe.' })
  @ApiCreatedResponse({ type: ContainerImageBuildRecipe })
  createRecipe(@Body() dto: CreateContainerImageRecipeDto) {
    return this.recipes.create(dto);
  }

  @Get('recipes/:id')
  @ApiOperation({ summary: 'Read an image build recipe.' })
  @ApiOkResponse({ type: ContainerImageBuildRecipe })
  getRecipe(@Param('id') id: string) {
    return this.recipes.get(id);
  }

  @Patch('recipes/:id')
  @ApiOperation({ summary: 'Update an image build recipe.' })
  @ApiOkResponse({ type: ContainerImageBuildRecipe })
  updateRecipe(
    @Param('id') id: string,
    @Body() dto: UpdateContainerImageRecipeDto,
  ) {
    return this.recipes.update(id, dto);
  }

  @Delete('recipes/:id')
  @ApiOperation({ summary: 'Remove an image build recipe.' })
  removeRecipe(@Param('id') id: string) {
    return this.recipes.remove(id);
  }

  @Get('builds')
  @ApiOperation({ summary: 'List recent image build jobs.' })
  @ApiOkResponse({ type: ContainerImageBuildJob, isArray: true })
  listBuilds() {
    return this.builder.listJobs();
  }

  @Get('gapps-presets')
  @ApiOperation({ summary: 'List managed ReDroid Google Play build presets.' })
  @ApiOkResponse({ type: GappsBuildPresetsResponseDto })
  listGappsPresets() {
    return this.gappsPresets.list();
  }

  @Post('gapps-builds')
  @ApiOperation({ summary: 'Queue a lightweight ReDroid GApps patch build.' })
  @ApiCreatedResponse({ type: ContainerImageBuildJob })
  startGappsBuild(@Body() dto: StartGappsBuildDto) {
    return this.gappsBuilder.startBuild(dto);
  }

  @Delete('gapps-cache/:androidVersion')
  @ApiOperation({ summary: 'Clear the managed GApps package cache.' })
  @ApiParam({ name: 'androidVersion', enum: ['13', '14'] })
  clearGappsCache(@Param('androidVersion') androidVersion: string) {
    return this.gappsBuilder.clearCache(androidVersion);
  }

  @Post('builds')
  @ApiOperation({ summary: 'Start an image build job.' })
  @ApiCreatedResponse({ type: ContainerImageBuildJob })
  startBuild(@Body() dto: StartContainerImageBuildDto) {
    return this.builder.startBuild(dto);
  }

  @Get('builds/:id')
  @ApiOperation({ summary: 'Read an image build job.' })
  @ApiOkResponse({ type: ContainerImageBuildJob })
  getBuild(@Param('id') id: string) {
    return this.builder.getJob(id);
  }

  @Post('builds/:id/cancel')
  @ApiOperation({ summary: 'Cancel an image build job.' })
  @ApiOkResponse({ type: ContainerImageBuildJob })
  cancelBuild(@Param('id') id: string) {
    return this.builder
      .getJob(id)
      .then((job) =>
        job.buildKind === 'redroid_gapps_patch'
          ? this.gappsBuilder.cancelBuild(id)
          : this.builder.cancelBuild(id),
      );
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
    return this.images.removeImage(
      decodeURIComponent(image),
      query.force ?? false,
    );
  }
}
