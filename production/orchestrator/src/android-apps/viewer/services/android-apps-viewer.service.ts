import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { DockerSidecarService } from '../../../docker/sidecar/services/docker-sidecar.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidApplicationStatus } from '../../android-application-status';
import type { ApplicationViewerControlCommand } from '../dto/application-viewer-control.dto';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { viewerControlShellCommand } from '../utils/android-apps-viewer-control.utils';
import { AndroidAppsViewerNetworkService } from './android-apps-viewer-network.service';

@Injectable()
export class AndroidAppsViewerService {
  constructor(
    private readonly config: ConfigService,
    private readonly exec: DockerContainerExecService,
    private readonly sidecar: DockerSidecarService,
    private readonly state: AndroidAppsStateService,
    private readonly viewerNetwork: AndroidAppsViewerNetworkService,
  ) {}

  /** Builds the viewer session data for scrcpy. */
  async scrcpySession(id: string): Promise<ScrcpySessionDto> {
    const app = await this.getRunningRuntimeApp(id);
    const proxyRemote =
      this.config.get<string>('app.scrcpy.wsScrcpyProxyRemote') ?? 'tcp:8886';
    const sidecarTarget = await this.sidecar.ensureSidecarOnNetwork(
      app.networkName,
    );
    const adbHost = await this.viewerNetwork.resolveScrcpyAdbHost(app);
    const udid = `${adbHost}:${app.adbPort}`;
    const viewerTarget =
      sidecarTarget.configured && sidecarTarget.connected
        ? await this.viewerNetwork.prepareScrcpyAdbTarget(app, adbHost)
        : sidecarTarget;
    app.lastScrcpyActivityAt = new Date();
    await this.state.save(app);

    return {
      applicationId: app.id,
      transport: app.scrcpyTransport,
      udid,
      proxyRemote,
      player: this.config.getOrThrow<string>('app.scrcpy.wsScrcpyPlayer'),
      viewerServiceConfigured: viewerTarget.configured,
      viewerTargetConnected: viewerTarget.connected,
      viewerMessage: viewerTarget.message,
      viewerError: viewerTarget.error,
      adbHost,
      adbPort: app.adbPort,
    };
  }

  /** Saves the latest viewer activity time. */
  async recordViewerActivity(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    app.lastScrcpyActivityAt = new Date();
    await this.state.save(app);

    return {
      id: app.id,
      lastScrcpyActivityAt: app.lastScrcpyActivityAt.toISOString(),
    };
  }

  /** Sends one control action to the viewer runtime. */
  async viewerControl(id: string, command: ApplicationViewerControlCommand) {
    const app = await this.getRunningRuntimeApp(id);
    await this.exec.execInContainerWithOutput(app.containerId!, [
      'sh',
      '-lc',
      viewerControlShellCommand(command),
    ]);
    await this.recordViewerActivity(id);

    return {
      command,
      executed: true,
      message: 'Viewer control command executed.',
    };
  }

  /** Loads one running app for viewer actions. */
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
