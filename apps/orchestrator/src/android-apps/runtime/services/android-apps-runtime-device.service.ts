import { ConflictException, Injectable } from '@nestjs/common';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';

@Injectable()
export class AndroidAppsRuntimeDeviceService {
  constructor(
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
    private readonly sidecarAdb: AndroidAppsSidecarAdbService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
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
    const app = await this.reconciler.reconcileById(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }
}
