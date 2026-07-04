import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateContainerImageRecipeDto,
  UpdateContainerImageRecipeDto,
} from '../dto/container-image-build.dto';
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

  async get(id: string) {
    const recipe = await this.recipes.findOneBy({ id });
    if (!recipe) {
      throw new NotFoundException('Container image recipe not found.');
    }
    return recipe;
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

  async update(id: string, dto: UpdateContainerImageRecipeDto) {
    const recipe = await this.get(id);
    if (dto.name !== undefined) {
      recipe.name = dto.name.trim();
    }
    if (dto.targetImage !== undefined) {
      recipe.targetImage = dto.targetImage.trim();
    }
    if (dto.baseImage !== undefined) {
      recipe.baseImage = dto.baseImage.trim();
    }
    if (dto.runtimeKind !== undefined) {
      recipe.runtimeKind = dto.runtimeKind;
    }
    if (dto.androidVersion !== undefined) {
      recipe.androidVersion = cleanNullable(dto.androidVersion);
    }
    if (dto.architecture !== undefined) {
      recipe.architecture = cleanNullable(dto.architecture);
    }
    if (dto.gmsMode !== undefined) {
      recipe.gmsMode = dto.gmsMode;
    }
    if (dto.signatureSpoofing !== undefined) {
      recipe.signatureSpoofing = dto.signatureSpoofing;
    }
    if (dto.dockerfile !== undefined) {
      recipe.dockerfile = dto.dockerfile;
    }
    if (dto.contextFileIds !== undefined) {
      recipe.contextFileIdsJson = idsJson(dto.contextFileIds);
    }

    return this.recipes.save(recipe);
  }

  async remove(id: string) {
    await this.recipes.delete(id);
    return { id, removed: true };
  }
}
