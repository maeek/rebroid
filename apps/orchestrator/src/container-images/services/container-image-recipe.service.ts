import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateContainerImageRecipeDto } from '../dto/container-image-build.dto';
import { ContainerImageBuildRecipe } from '../entities/container-image-build-recipe.entity';

const cleanNullable = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const idsJson = (ids: string[] | undefined) => JSON.stringify(ids ?? []);

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
        runtimeKind: dto.runtimeKind ?? 'redroid',
        androidVersion: cleanNullable(dto.androidVersion),
        architecture: cleanNullable(dto.architecture),
        gmsMode: dto.gmsMode ?? 'microg',
        signatureSpoofing: dto.signatureSpoofing ?? 'external_required',
        dockerfile: dto.dockerfile,
        contextFileIdsJson: idsJson(dto.contextFileIds),
      }),
    );
  }
}
