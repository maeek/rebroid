import { ApiProperty } from '@nestjs/swagger';

export class ManagedContainerUsageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  status!: string;
}

export class ManagedVolumeUsageDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ type: Number, nullable: true })
  sizeBytes!: number | null;
}

export class SystemResourcesDto {
  @ApiProperty({ type: Number, nullable: true })
  hostMemoryBytes!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  hostCpuCores!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  dockerRootAvailableBytes!: number | null;

  @ApiProperty()
  containersTotal!: number;

  @ApiProperty()
  containersRunning!: number;

  @ApiProperty()
  containersStopped!: number;

  @ApiProperty()
  managedContainersCpuUsagePercent!: number;

  @ApiProperty()
  managedContainersMemoryUsageBytes!: number;

  @ApiProperty({ type: String, nullable: true })
  containerStatsCollectedAt!: string | null;

  @ApiProperty()
  managedVolumesTotal!: number;

  @ApiProperty()
  managedVolumesSizeBytes!: number;

  @ApiProperty({ type: String, nullable: true })
  volumeUsageCachedAt!: string | null;

  @ApiProperty({ type: [ManagedContainerUsageDto] })
  containers!: ManagedContainerUsageDto[];

  @ApiProperty({ type: [ManagedVolumeUsageDto] })
  volumes!: ManagedVolumeUsageDto[];
}

export class SystemResourceCapacityDto {
  @ApiProperty({ type: Number, nullable: true })
  hostMemoryBytes!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  hostCpuCores!: number | null;
}
