import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidAppsCommonModule } from '../android-apps/common/android-apps-common.module';
import { ApkModule } from '../apk/apk.module';
import { DockerModule } from '../docker/docker.module';
import { ScheduledTasksController } from './controllers/scheduled-tasks.controller';
import { ScheduledTask } from './entities/scheduled-task.entity';
import { ScheduledTaskActionsService } from './services/scheduled-task-actions.service';
import { ScheduledTasksService } from './services/scheduled-tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledTask]),
    ApkModule,
    DockerModule,
    AndroidAppsCommonModule,
  ],
  controllers: [ScheduledTasksController],
  providers: [ScheduledTasksService, ScheduledTaskActionsService],
})
export class ScheduledTasksModule {}
