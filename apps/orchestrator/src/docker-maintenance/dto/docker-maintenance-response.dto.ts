import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageMetadataSource,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';

export class RuntimeImageMetadataDto {
  @ApiProperty({ enum: ['redroid', 'generic'] })
  runtimeKind!: RuntimeImageKind;

  @ApiProperty({ type: String, nullable: true })
  androidVersion!: string | null;

  @ApiProperty({ type: String, nullable: true })
  architecture!: string | null;

  @ApiProperty({ enum: ['none', 'microg', 'gapps'] })
  gmsMode!: RuntimeImageGmsMode;

  @ApiProperty({
    enum: [
      'not_applicable',
      'external_required',
      'present_unverified',
      'verified',
    ],
  })
  signatureSpoofing!: RuntimeImageSignatureSpoofing;
}

export class DockerPlatformContainerPortDto {
  @ApiProperty()
  privatePort!: number;

  @ApiProperty({ type: Number, nullable: true })
  publicPort!: number | null;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: String, nullable: true })
  ip!: string | null;
}

export class DockerPlatformContainerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shortId!: string;

  @ApiProperty({ type: [String] })
  names!: string[];

  @ApiProperty()
  image!: string;

  @ApiProperty()
  imageId!: string;

  @ApiProperty()
  command!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  labels!: Record<string, string>;

  @ApiProperty()
  managed!: boolean;

  @ApiProperty()
  orphaned!: boolean;

  @ApiProperty({ type: String, nullable: true })
  applicationId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  component!: string | null;

  @ApiProperty({ type: [DockerPlatformContainerPortDto] })
  ports!: DockerPlatformContainerPortDto[];

  @ApiProperty({ type: [String] })
  networks!: string[];
}

export class DockerPlatformContainerLogDto {
  @ApiProperty({ enum: ['container'] })
  source!: 'container';

  @ApiProperty()
  collectedAt!: string;

  @ApiProperty()
  output!: string;
}

export class DockerPlatformContainerStatsDto {
  @ApiProperty()
  cpuUsagePercent!: number;

  @ApiProperty()
  memoryUsageBytes!: number;

  @ApiProperty({ type: Number, nullable: true })
  memoryLimitBytes!: number | null;

  @ApiProperty()
  networkRxBytes!: number;

  @ApiProperty()
  networkTxBytes!: number;

  @ApiProperty()
  collectedAt!: string;
}

export class DockerPlatformImageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shortId!: string;

  @ApiProperty({ type: [String] })
  repoTags!: string[];

  @ApiProperty({ type: [String] })
  repoDigests!: string[];

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty()
  sharedSizeBytes!: number;

  @ApiProperty()
  virtualSizeBytes!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  labels!: Record<string, string>;

  @ApiProperty()
  managed!: boolean;

  @ApiProperty()
  containers!: number;

  @ApiProperty({ type: () => RuntimeImageMetadataDto, nullable: true })
  runtimeMetadata!: RuntimeImageMetadataDto | null;

  @ApiProperty({ enum: ['stored', 'labels', 'name'], nullable: true })
  runtimeMetadataSource!: RuntimeImageMetadataSource | null;
}

export class DockerPlatformNetworkDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shortId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  driver!: string;

  @ApiProperty()
  scope!: string;

  @ApiProperty({ type: String, nullable: true })
  createdAt!: string | null;

  @ApiProperty()
  internal!: boolean;

  @ApiProperty()
  attachable!: boolean;

  @ApiProperty()
  ingress!: boolean;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  labels!: Record<string, string>;

  @ApiProperty()
  managed!: boolean;

  @ApiProperty({ type: [String] })
  containers!: string[];

  @ApiProperty({ type: [String] })
  subnets!: string[];

  @ApiProperty({ type: [String] })
  gateways!: string[];
}

export class DockerPlatformContainerDetailsDto {
  @ApiProperty({ type: DockerPlatformContainerDto })
  container!: DockerPlatformContainerDto;

  @ApiProperty({ type: 'object', additionalProperties: true })
  inspect!: Record<string, unknown>;

  @ApiProperty({ type: DockerPlatformImageDto, nullable: true })
  relatedImage!: DockerPlatformImageDto | null;

  @ApiProperty({ type: [DockerPlatformNetworkDto] })
  relatedNetworks!: DockerPlatformNetworkDto[];
}

export class DockerPlatformImageDetailsDto {
  @ApiProperty({ type: DockerPlatformImageDto })
  image!: DockerPlatformImageDto;

  @ApiProperty({ type: 'object', additionalProperties: true })
  inspect!: Record<string, unknown>;

  @ApiProperty({ type: [DockerPlatformContainerDto] })
  relatedContainers!: DockerPlatformContainerDto[];
}

export class DockerPlatformNetworkDetailsDto {
  @ApiProperty({ type: DockerPlatformNetworkDto })
  network!: DockerPlatformNetworkDto;

  @ApiProperty({ type: 'object', additionalProperties: true })
  inspect!: Record<string, unknown>;

  @ApiProperty({ type: [DockerPlatformContainerDto] })
  relatedContainers!: DockerPlatformContainerDto[];
}

export class DockerPlatformRemovalResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  removed!: boolean;
}

export class DockerPlatformStopResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  stopped!: boolean;
}

export class DockerPrunedImageDto {
  @ApiPropertyOptional()
  Deleted?: string;

  @ApiPropertyOptional()
  Untagged?: string;
}

export class DockerPruneResponseDto {
  @ApiPropertyOptional({ type: [String] })
  ContainersDeleted?: string[];

  @ApiPropertyOptional({ type: [DockerPrunedImageDto] })
  ImagesDeleted?: DockerPrunedImageDto[];

  @ApiPropertyOptional({ type: [String] })
  NetworksDeleted?: string[];

  @ApiPropertyOptional({ type: [String] })
  VolumesDeleted?: string[];

  @ApiPropertyOptional()
  SpaceReclaimed?: number;
}

export class DockerPruneAllResponseDto {
  @ApiProperty({ type: DockerPruneResponseDto })
  containers!: DockerPruneResponseDto;

  @ApiProperty({ type: DockerPruneResponseDto })
  networks!: DockerPruneResponseDto;

  @ApiProperty({ type: DockerPruneResponseDto })
  images!: DockerPruneResponseDto;

  @ApiProperty({ type: DockerPruneResponseDto })
  volumes!: DockerPruneResponseDto;
}
