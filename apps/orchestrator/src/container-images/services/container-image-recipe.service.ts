import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateContainerImageRecipeDto } from '../dto/container-image-build.dto';
import { ContainerImageBuildRecipe } from '../entities/container-image-build-recipe.entity';

import { buildRuntimeMetadata } from '../utils/container-image-build-metadata';

@Injectable()
export class ContainerImageRecipeService {
  constructor(
    @InjectRepository(ContainerImageBuildRecipe)
    private readonly recipes: Repository<ContainerImageBuildRecipe>,
  ) {}

  list() {
    return this.recipes.find({ order: { updatedAt: 'DESC' } });
  }

  create(dto: CreateContainerImageRecipeDto) {
    return this.recipes.save(
      this.recipes.create({
        name: dto.name.trim(),
        targetImage: dto.targetImage.trim(),
        baseImage: dto.baseImage.trim(),
        ...buildRuntimeMetadata(dto),
        dockerfile: dto.dockerfile,
        contextFileIdsJson: JSON.stringify(dto.contextFileIds ?? []),
      }),
    );
  }
}
