import { ApiProperty } from '@nestjs/swagger';

export class DockerMetricsLimitsDto {
  @ApiProperty() maxConcurrentReads!: number;
  @ApiProperty() maxConcurrentLongOperations!: number;
  @ApiProperty() slowRequestWarningMs!: number;
  @ApiProperty() longOperationTimeoutMs!: number;
  @ApiProperty() remoteRequestTimeoutMs!: number;
}

export class DockerMetricsTotalsDto {
  @ApiProperty() success!: number;
  @ApiProperty() errors!: number;
  @ApiProperty() timeouts!: number;
  @ApiProperty() retries!: number;
  @ApiProperty() slow!: number;
}

export class DockerMetricsClassCountsDto {
  @ApiProperty() read!: number;
  @ApiProperty() mutation!: number;
  @ApiProperty() long!: number;
}

export class DockerMetricsOperationDto {
  @ApiProperty({ enum: ['read', 'mutation', 'long'] })
  class!: 'read' | 'mutation' | 'long';
  @ApiProperty() operation!: string;
  @ApiProperty() success!: number;
  @ApiProperty() errors!: number;
  @ApiProperty() timeouts!: number;
  @ApiProperty() retries!: number;
  @ApiProperty() slow!: number;
  @ApiProperty() totalDurationMs!: number;
  @ApiProperty() maxDurationMs!: number;
  @ApiProperty() averageDurationMs!: number;
}

export class DockerMetricsEventDto {
  @ApiProperty() timestamp!: string;
  @ApiProperty({ enum: ['read', 'mutation', 'long'] })
  class!: 'read' | 'mutation' | 'long';
  @ApiProperty() operation!: string;
  @ApiProperty({ enum: ['error', 'timeout', 'slow'] })
  outcome!: 'error' | 'timeout' | 'slow';
  @ApiProperty() durationMs!: number;
  @ApiProperty({ nullable: true, type: String }) error!: string | null;
}

export class DockerMetricsSnapshotDto {
  @ApiProperty() collectedAt!: string;
  @ApiProperty() transport!: string;
  @ApiProperty({ type: DockerMetricsLimitsDto })
  limits!: DockerMetricsLimitsDto;
  @ApiProperty({ type: DockerMetricsTotalsDto })
  totals!: DockerMetricsTotalsDto;
  @ApiProperty({ type: DockerMetricsClassCountsDto })
  inFlight!: DockerMetricsClassCountsDto;
  @ApiProperty({ type: DockerMetricsClassCountsDto })
  queued!: DockerMetricsClassCountsDto;
  @ApiProperty({ type: [DockerMetricsOperationDto] })
  operations!: DockerMetricsOperationDto[];
  @ApiProperty({ type: [DockerMetricsEventDto] })
  events!: DockerMetricsEventDto[];
}
