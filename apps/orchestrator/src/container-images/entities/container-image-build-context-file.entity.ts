import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'container_image_build_context_files' })
export class ContainerImageBuildContextFile {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'microg.apk' })
  @Column()
  originalName!: string;

  @ApiProperty({ example: 'apks/microg.apk' })
  @Column()
  contextPath!: string;

  @ApiProperty()
  @Column()
  storedPath!: string;

  @ApiProperty()
  @Column({ type: 'integer' })
  sizeBytes!: number;

  @ApiProperty()
  @Column()
  sha256!: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;
}
