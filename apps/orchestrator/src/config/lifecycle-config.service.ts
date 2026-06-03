import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LifecycleConfigService {
  constructor(private readonly config: ConfigService) {}

  get maxConcurrentJobs() {
    return this.config.getOrThrow<number>('app.lifecycle.maxConcurrentJobs');
  }
}
