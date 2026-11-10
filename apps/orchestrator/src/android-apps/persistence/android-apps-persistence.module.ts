import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-application.entity';
import { ANDROID_APPS_APK_REFERENCES } from '../contracts/android-apps-apk-references.port';
import { ANDROID_APPS_RUNTIME_INVENTORY } from '../contracts/android-apps-runtime-inventory.port';
import { AndroidAppLifecycleJob } from '../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidApplicationsRepository } from './android-applications.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([AndroidApplication, AndroidAppLifecycleJob]),
  ],
  providers: [
    AndroidApplicationsRepository,
    {
      provide: ANDROID_APPS_APK_REFERENCES,
      useExisting: AndroidApplicationsRepository,
    },
    {
      provide: ANDROID_APPS_RUNTIME_INVENTORY,
      useExisting: AndroidApplicationsRepository,
    },
  ],
  exports: [
    AndroidApplicationsRepository,
    ANDROID_APPS_APK_REFERENCES,
    ANDROID_APPS_RUNTIME_INVENTORY,
  ],
})
export class AndroidAppsPersistenceModule {}
