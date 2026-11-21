import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  runtimeImageKinds,
  runtimeImageGmsModes,
  runtimeImageSignatureSpoofingStates,
  type RuntimeImageGmsMode,
  type RuntimeImageKind,
  type RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';

export abstract class ContainerImageBuildDefinition {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'local/redroid-microg:14' })
  @Column()
  targetImage!: string;

  @ApiProperty({ example: 'redroid/redroid:14.0.0-latest' })
  @Column()
  baseImage!: string;

  @ApiProperty({ enum: runtimeImageKinds })
  @Column({ default: 'redroid' })
  runtimeKind!: RuntimeImageKind;

  @ApiPropertyOptional({ type: String, example: '14', nullable: true })
  @Column({ type: 'text', nullable: true })
  androidVersion!: string | null;

  @ApiPropertyOptional({ type: String, example: 'amd64', nullable: true })
  @Column({ type: 'text', nullable: true })
  architecture!: string | null;

  @ApiProperty({ enum: runtimeImageGmsModes })
  @Column({ default: 'microg' })
  gmsMode!: RuntimeImageGmsMode;

  @ApiProperty({
    enum: runtimeImageSignatureSpoofingStates,
  })
  @Column({ default: 'external_required' })
  signatureSpoofing!: RuntimeImageSignatureSpoofing;

  @ApiProperty()
  @Column({ type: 'text' })
  dockerfile!: string;

  @ApiProperty()
  @Column({ type: 'text', default: '[]' })
  contextFileIdsJson!: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;
}
