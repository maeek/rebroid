import { Module } from '@nestjs/common';
import { AndroidAppsModule } from '../android-apps/android-apps.module';
import { ScrcpyGateway } from './scrcpy.gateway';

@Module({
  imports: [AndroidAppsModule],
  providers: [ScrcpyGateway],
})
export class ScrcpyModule {}
