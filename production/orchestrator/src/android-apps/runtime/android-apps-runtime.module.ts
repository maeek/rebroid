import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsRuntimeController } from './controllers/android-apps-runtime.controller';
import { AndroidAppsRuntimeAccessService } from './services/android-apps-runtime-access.service';

@Module({
  imports: [DockerModule, AndroidAppsCommonModule],
  controllers: [AndroidAppsRuntimeController],
  providers: [AndroidAppsRuntimeAccessService],
  exports: [AndroidAppsRuntimeAccessService],
})
export class AndroidAppsRuntimeModule {}
