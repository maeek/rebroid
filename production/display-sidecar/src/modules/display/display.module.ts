import { Module } from '@nestjs/common';
import { AdbModule } from '../adb/adb.module';
import { ScrcpyModule } from '../scrcpy/scrcpy.module';
import { SidecarAuthGuard } from '../shared/sidecar-auth.guard';
import { SidecarConfigService } from '../shared/sidecar-config.service';
import { DisplayController } from './display.controller';
import { DisplayGateway } from './display.gateway';
import { DisplaySessionService } from './display-session.service';

@Module({
  imports: [AdbModule, ScrcpyModule],
  controllers: [DisplayController],
  providers: [DisplayGateway, DisplaySessionService, SidecarAuthGuard, SidecarConfigService],
  exports: [DisplaySessionService],
})
export class DisplayModule {}
