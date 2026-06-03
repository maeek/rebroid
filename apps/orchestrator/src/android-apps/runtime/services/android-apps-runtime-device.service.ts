import { ConflictException, Injectable } from '@nestjs/common';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';

@Injectable()
export class AndroidAppsRuntimeDeviceService {
  constructor(
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
    private readonly sidecarAdb: AndroidAppsSidecarAdbService,
    private readonly state: AndroidAppsStateService,
  ) {}

  async getClipboard(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const clipboard = await this.sidecarAdb.getClipboard(app);

    return {
      text: clipboard.text,
      supported: clipboard.supported,
      message: clipboard.supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  async setClipboard(id: string, text: string) {
    const app = await this.getRunningRuntimeApp(id);
    const clipboard = await this.displaySidecar
      .setClipboard(app, text)
      .catch(() => this.sidecarAdb.setClipboard(app, text));

    return {
      text: clipboard.text,
      supported: clipboard.supported,
      message: clipboard.supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  async screenshot(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    return this.sidecarAdb.screenshot(app);
  }

  private async getRunningRuntimeApp(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }
}
