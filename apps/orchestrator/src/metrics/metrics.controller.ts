import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { DockerMetricsSnapshotDto } from './dto/docker-metrics.dto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async read(@Res() response: Response) {
    response.setHeader('content-type', this.metrics.registry.contentType);
    response.send(await this.metrics.registry.metrics());
  }

  @Get('docker')
  @ApiOkResponse({ type: DockerMetricsSnapshotDto })
  dockerSnapshot(): DockerMetricsSnapshotDto {
    return this.metrics.dockerSnapshot();
  }
}
