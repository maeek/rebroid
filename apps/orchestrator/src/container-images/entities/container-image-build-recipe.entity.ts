import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/application-core/redroid-runtime';

@Entity({ name: 'container_image_build_recipes' })
export class ContainerImageBuildRecipe {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'Redroid 14 microG overlay' })
  @Column()
  name!: string;

  @ApiProperty({ example: 'local/redroid-microg:14' })
  @Column()
  targetImage!: string;

  @ApiProperty({ example: 'redroid/redroid:14.0.0-latest' })
  @Column()
  baseImage!: string;

  @ApiProperty({ enum: ['redroid', 'generic'] })
  @Column({ default: 'redroid' })
  runtimeKind!: RuntimeImageKind;

  @ApiPropertyOptional({ example: '14', nullable: true })
  @Column({ type: 'text', nullable: true })
  androidVersion!: string | null;

  @ApiPropertyOptional({ example: 'amd64', nullable: true })
  @Column({ type: 'text', nullable: true })
  architecture!: string | null;

  @ApiProperty({ enum: ['none', 'microg'] })
  @Column({ default: 'microg' })
  gmsMode!: RuntimeImageGmsMode;

  @ApiProperty({
    enum: [
      'not_applicable',
      'external_required',
      'present_unverified',
      'verified',
    ],
  })
  @Column({ default: 'external_required' })
  signatureSpoofing!: RuntimeImageSignatureSpoofing;

  @ApiProperty()
  @Column({ type: 'text' })
  dockerfile!: string;

  @ApiProperty()
  @Column({ type: 'text', default: "'[]'" })
  contextFileIdsJson!: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;
}
