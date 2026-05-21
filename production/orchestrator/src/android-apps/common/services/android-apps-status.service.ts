import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AndroidApplication } from '../../android-application.entity';
import { parseImagePullProgress } from '../utils/android-apps-status.utils';
import { deriveApplicationError } from '../utils/android-apps-error-status.utils';
import { deriveNetworkPolicyResult } from '../utils/android-apps-network-policy-result.utils';
import { deriveStatusDetail } from '../utils/android-apps-status-detail.utils';
import {
  containerExitedMessage,
  stoppedStatusMessage,
} from '../utils/android-apps-status-message.utils';

@Injectable()
export class AndroidAppsStatusService {
  constructor(private readonly config: ConfigService) {}

  /** Fills the extra status fields shown in the UI. */
  decorateApplication(app: AndroidApplication) {
    app.imagePullProgress = parseImagePullProgress(
      app.statusMessage,
      app.lifecycleStage,
    );
    app.networkPolicyResult = deriveNetworkPolicyResult(
      app,
      this.config.getOrThrow<boolean>('app.docker.iptablesEnabled'),
    );
    app.applicationError = deriveApplicationError(app);
    app.statusDetail = deriveStatusDetail(app);
    return app;
  }

  /** Builds the stopped message for an app. */
  stoppedStatusMessage(app: AndroidApplication) {
    return stoppedStatusMessage(app);
  }

  /** Explains why a container stopped. */
  containerExitedMessage(
    app: AndroidApplication,
    runtimeState: import('../../../docker/docker.types').ContainerRuntimeState,
  ) {
    return containerExitedMessage(app, runtimeState);
  }
}
