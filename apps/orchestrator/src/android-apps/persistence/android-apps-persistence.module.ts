import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-application.entity';
import { AndroidAppLifecycleJob } from '../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsRepository } from './android-app-lifecycle-jobs.repository';
import { AndroidApplicationsRepository } from './android-applications.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([AndroidApplication, AndroidAppLifecycleJob]),
  ],
  providers: [AndroidApplicationsRepository, AndroidAppLifecycleJobsRepository],
  exports: [AndroidApplicationsRepository, AndroidAppLifecycleJobsRepository],
})
export class AndroidAppsPersistenceModule {}
