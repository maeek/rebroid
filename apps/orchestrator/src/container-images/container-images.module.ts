import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../docker/docker.module';
import { ApkModule } from '../apk/apk.module';
import { SettingsModule } from '../settings/settings.module';
import { ContainerImagesController } from './container-images.controller';
import { CONTAINER_IMAGE_BUILD_MAINTENANCE } from './contracts/container-image-build-maintenance.port';
import { ContainerImageBuildContextFile } from './entities/container-image-build-context-file.entity';
import { ContainerImageBuildJob } from './entities/container-image-build-job.entity';
import { ContainerImageBuildRecipe } from './entities/container-image-build-recipe.entity';
import { ContainerImageBuilderService } from './services/container-image-builder.service';
import { ContainerImageBuildArchiveService } from './services/container-image-build-archive.service';
import { ContainerImageBuildContextService } from './services/container-image-build-context.service';
import { ContainerImageBuildJobService } from './services/container-image-build-job.service';
import { ContainerImageBuildMaintenanceService } from './services/container-image-build-maintenance.service';
import { ContainerImageRecipeService } from './services/container-image-recipe.service';
import { ContainerImageGappsBuilderService } from './services/container-image-gapps-builder.service';
import { ContainerImageGappsCacheService } from './services/container-image-gapps-cache.service';
import { ContainerImageGappsPackageService } from './services/container-image-gapps-package.service';
import { ContainerImageGappsPresetService } from './services/container-image-gapps-preset.service';
import { ContainerImageGappsSourceService } from './services/container-image-gapps-source.service';
import { ContainerImageGappsWorkerService } from './services/container-image-gapps-worker.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    DockerModule,
    ApkModule,
    SettingsModule,
    FeatureFlagsModule,
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
    ContainerImageBuildMaintenanceService,
    {
      provide: CONTAINER_IMAGE_BUILD_MAINTENANCE,
      useExisting: ContainerImageBuildMaintenanceService,
    },
    ContainerImageRecipeService,
    ContainerImageGappsBuilderService,
    ContainerImageGappsCacheService,
    ContainerImageGappsPackageService,
    ContainerImageGappsPresetService,
    ContainerImageGappsSourceService,
    ContainerImageGappsWorkerService,
  ],
  exports: [CONTAINER_IMAGE_BUILD_MAINTENANCE],
})
export class ContainerImagesModule {}
