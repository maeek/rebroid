import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { AndroidAppLifecycleJob } from '../android-apps/lifecycle/entities/android-app-lifecycle-job.entity';
import { UploadedApk } from '../apk/entities/uploaded-apk.entity';
import { AutomationRun } from '../automations/entities/automation-run.entity';
import { AutomationRunEvent } from '../automations/entities/automation-run-event.entity';
import { AutomationTrigger } from '../automations/entities/automation-trigger.entity';
import { Automation } from '../automations/entities/automation.entity';
import { ContainerImageBuildContextFile } from '../container-images/entities/container-image-build-context-file.entity';
import { ContainerImageBuildJob } from '../container-images/entities/container-image-build-job.entity';
import { ContainerImageBuildRecipe } from '../container-images/entities/container-image-build-recipe.entity';
import { ContainerImageRuntimeMetadata } from '../docker/images/entities/container-image-runtime-metadata.entity';
import { ScheduledTask } from '../scheduled-tasks/entities/scheduled-task.entity';
import { InitializeSqliteSchema1800000000000 } from './migrations/1800000000000-initialize-sqlite-schema';
import { AddAutomationRunEventsTable1800000000001 } from './migrations/1800000000001-add-automation-run-events-table';
import { AddRuntimeImageMetadata1800000000002 } from './migrations/1800000000002-add-runtime-image-metadata';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const database = config.getOrThrow<string>('app.databasePath');
        mkdirSync(dirname(database), { recursive: true });

        return {
          type: 'better-sqlite3',
          database,
          entities: [
            AndroidApplication,
            AndroidAppLifecycleJob,
            UploadedApk,
            ScheduledTask,
            Automation,
            AutomationRun,
            AutomationRunEvent,
            AutomationTrigger,
            ContainerImageBuildContextFile,
            ContainerImageBuildJob,
            ContainerImageBuildRecipe,
            ContainerImageRuntimeMetadata,
          ],
          migrations: [
            InitializeSqliteSchema1800000000000,
            AddAutomationRunEventsTable1800000000001,
            AddRuntimeImageMetadata1800000000002,
          ],
          migrationsRun: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
