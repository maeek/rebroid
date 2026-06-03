import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import { DockerEngineConfigService } from './docker-engine-config.service';
import { LifecycleConfigService } from './lifecycle-config.service';
import { RedroidRuntimeConfigService } from './redroid-runtime-config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      envFilePath: ['.env'],
    }),
  ],
  providers: [
    DockerEngineConfigService,
    LifecycleConfigService,
    RedroidRuntimeConfigService,
  ],
  exports: [
    DockerEngineConfigService,
    LifecycleConfigService,
    RedroidRuntimeConfigService,
  ],
})
export class AppConfigModule {}
