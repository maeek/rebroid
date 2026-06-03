import { Injectable } from '@nestjs/common';
import pLimit from 'p-limit';
import { LifecycleConfigService } from '../../../config/lifecycle-config.service';

@Injectable()
export class LifecycleBackgroundJobRunner {
  private readonly backgroundJobs = new Set<string>();
  private readonly limitBackgroundJob: ReturnType<typeof pLimit>;

  constructor(config: LifecycleConfigService) {
    this.limitBackgroundJob = pLimit(config.maxConcurrentJobs);
  }

  schedule(key: string, operation: () => Promise<void>) {
    if (this.backgroundJobs.has(key)) {
      return;
    }

    this.backgroundJobs.add(key);
    void this.limitBackgroundJob(operation).finally(() => {
      this.backgroundJobs.delete(key);
    });
  }
}
