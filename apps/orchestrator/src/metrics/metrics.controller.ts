import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async read(@Res() response: Response) {
    response.setHeader('content-type', this.metrics.registry.contentType);
    response.send(await this.metrics.registry.metrics());
  }
}
