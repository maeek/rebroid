import { Injectable } from '@nestjs/common';
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
    const app = await this.reconciler.requireRunningById(id);
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
    const app = await this.reconciler.requireRunningById(id);
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
    const app = await this.reconciler.requireRunningById(id);
    return this.sidecarAdb.screenshot(app);
  }
}
