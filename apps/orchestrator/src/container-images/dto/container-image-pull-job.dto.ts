import { ApiProperty } from '@nestjs/swagger';

const pullPhases = [
  'queued',
  'contacting-registry',
  'transferring-layers',
  'registering',
  'pulled',
  'failed',
] as const;

export class ContainerImagePullJobDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  image!: string;

  @ApiProperty({ enum: pullPhases })
  phase!: (typeof pullPhases)[number];
}
