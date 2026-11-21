import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
import { ContainerImageBuildDefinition } from './container-image-build-definition';

@Entity({ name: 'container_image_build_recipes' })
export class ContainerImageBuildRecipe extends ContainerImageBuildDefinition {
  @ApiProperty({ example: 'Redroid 14 microG overlay' })
  @Column()
  name!: string;
}
