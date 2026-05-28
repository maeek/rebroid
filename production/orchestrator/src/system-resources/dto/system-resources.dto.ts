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

  @ApiProperty({ nullable: true })
  sizeBytes!: number | null;
}

export class SystemResourcesDto {
  @ApiProperty({ nullable: true })
  hostMemoryBytes!: number | null;

  @ApiProperty({ nullable: true })
  hostCpuCores!: number | null;

  @ApiProperty({ nullable: true })
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

  @ApiProperty({ nullable: true })
  containerStatsCollectedAt!: string | null;

  @ApiProperty()
  managedVolumesTotal!: number;

  @ApiProperty()
  managedVolumesSizeBytes!: number;

  @ApiProperty()
  volumeUsageCachedAt!: string | null;

  @ApiProperty({ type: [ManagedContainerUsageDto] })
  containers!: ManagedContainerUsageDto[];

  @ApiProperty({ type: [ManagedVolumeUsageDto] })
  volumes!: ManagedVolumeUsageDto[];
}

export class SystemResourceCapacityDto {
  @ApiProperty({ nullable: true })
  hostMemoryBytes!: number | null;

  @ApiProperty({ nullable: true })
  hostCpuCores!: number | null;
}
