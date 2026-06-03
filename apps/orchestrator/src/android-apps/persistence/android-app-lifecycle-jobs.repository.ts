import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AndroidAppLifecycleJob,
  AndroidAppLifecycleJobKind,
} from '../lifecycle/entities/android-app-lifecycle-job.entity';

@Injectable()
export class AndroidAppLifecycleJobsRepository {
  constructor(
    @InjectRepository(AndroidAppLifecycleJob)
    private readonly jobs: Repository<AndroidAppLifecycleJob>,
  ) {}

  create(values: Partial<AndroidAppLifecycleJob>) {
    return this.jobs.create(values);
  }

  save(job: AndroidAppLifecycleJob) {
    return this.jobs.save(job);
  }

  findByApplicationAndKind(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
  ) {
    return this.jobs.findOneBy({ applicationId, kind });
  }

  deleteByApplicationAndKind(
    applicationId: string,
    kind: AndroidAppLifecycleJobKind,
  ) {
    return this.jobs.delete({ applicationId, kind });
  }

  deleteByApplication(applicationId: string) {
    return this.jobs.delete({ applicationId });
  }

  listPending() {
    return this.jobs.find({ order: { updatedAt: 'ASC' } });
  }
}
