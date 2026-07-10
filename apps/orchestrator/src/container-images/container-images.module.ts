import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../docker/docker.module';
import { ApkModule } from '../apk/apk.module';
import { SettingsModule } from '../settings/settings.module';
import { ContainerImagesController } from './container-images.controller';
import { ContainerImageBuildContextFile } from './entities/container-image-build-context-file.entity';
import { ContainerImageBuildJob } from './entities/container-image-build-job.entity';
import { ContainerImageBuildRecipe } from './entities/container-image-build-recipe.entity';
import { ContainerImageBuilderService } from './services/container-image-builder.service';
import { ContainerImageBuildArchiveService } from './services/container-image-build-archive.service';
import { ContainerImageBuildContextService } from './services/container-image-build-context.service';
import { ContainerImageBuildJobService } from './services/container-image-build-job.service';
import { ContainerImageRecipeService } from './services/container-image-recipe.service';
import { ContainerImageGappsBuilderService } from './services/container-image-gapps-builder.service';
import { ContainerImageGappsCacheService } from './services/container-image-gapps-cache.service';
import { ContainerImageGappsPackageService } from './services/container-image-gapps-package.service';
import { ContainerImageGappsPresetService } from './services/container-image-gapps-preset.service';
import { ContainerImageGappsSourceService } from './services/container-image-gapps-source.service';
import { ContainerImageGappsWorkerService } from './services/container-image-gapps-worker.service';

@Module({
  imports: [
    DockerModule,
    ApkModule,
    SettingsModule,
    TypeOrmModule.forFeature([
      ContainerImageBuildContextFile,
      ContainerImageBuildJob,
      ContainerImageBuildRecipe,
    ]),
  ],
  controllers: [ContainerImagesController],
  providers: [
    ContainerImageBuilderService,
    ContainerImageBuildArchiveService,
    ContainerImageBuildContextService,
    ContainerImageBuildJobService,
    ContainerImageRecipeService,
    ContainerImageGappsBuilderService,
    ContainerImageGappsCacheService,
    ContainerImageGappsPackageService,
    ContainerImageGappsPresetService,
    ContainerImageGappsSourceService,
    ContainerImageGappsWorkerService,
  ],
})
export class ContainerImagesModule {}
