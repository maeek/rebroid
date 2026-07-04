import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../docker/docker.module';
import { SettingsModule } from '../settings/settings.module';
import { ContainerImagesController } from './container-images.controller';
import { ContainerImageBuildContextFile } from './entities/container-image-build-context-file.entity';
import { ContainerImageBuildJob } from './entities/container-image-build-job.entity';
import { ContainerImageBuildRecipe } from './entities/container-image-build-recipe.entity';
import { ContainerImageBuilderService } from './services/container-image-builder.service';
import { ContainerImageBuildContextService } from './services/container-image-build-context.service';
import { ContainerImageRecipeService } from './services/container-image-recipe.service';

@Module({
  imports: [
    DockerModule,
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
    ContainerImageBuildContextService,
    ContainerImageRecipeService,
  ],
})
export class ContainerImagesModule {}
