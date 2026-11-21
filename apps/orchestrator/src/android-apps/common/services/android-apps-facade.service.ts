import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { StartAndroidApplicationDto } from '../../lifecycle/dto/start-android-application.dto';
import { AndroidAppsNetworkPolicyService } from '../../network/services/android-apps-network-policy.service';
import { AndroidAppsQueryService } from './android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from './android-apps-runtime-state-reconciler.service';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';
import type {
  AndroidAppsAutomationPort,
  AndroidAutomationAdapters,
  AndroidAutomationApplication,
  AndroidAutomationTarget,
} from '../../contracts/android-apps-automation.port';
import { AndroidAppsRuntimeOperationGate } from './android-apps-runtime-operation-gate.service';

@Injectable()
export class AndroidAppsFacadeService implements AndroidAppsAutomationPort {
  constructor(
    private readonly lifecycle: AndroidAppsLifecycleService,
    private readonly network: AndroidAppsNetworkPolicyService,
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly display: AndroidAppsDisplaySidecarService,
    private readonly adb: AndroidAppsSidecarAdbService,
    private readonly runtimeOperations: AndroidAppsRuntimeOperationGate,
  ) {}

  /** Loads one app. */
  get(id: string): Promise<AndroidApplication> {
    return this.queries.getStored(id);
  }

  async applyPlatformContainerChange(
    applicationId: string,
    containerId: string,
    operation: () => Promise<void>,
  ) {
    await this.runtimeOperations.interrupt(applicationId, async () => {
      const app = await this.queries
        .getStored(applicationId)
        .catch((error: unknown) => {
          if (error instanceof NotFoundException) return null;
          throw error;
        });
      await operation();
      if (app?.containerId === containerId)
        await this.reconciler.reconcileOne(app);
    });
  }

  async withPlatformContainerTerminal(
    applicationId: string,
    containerId: string,
    startedAt: string,
    controller: AbortController,
    operation: () => Promise<void>,
  ) {
    const app = await this.queries.getStored(applicationId);
    await this.runtimeOperations.withCurrentRuntime(
      app,
      controller.signal,
      async (current, managedAdbHost) => {
        if (
          current.containerId !== containerId ||
          current.containerStartedAt !== startedAt ||
          !managedAdbHost
        ) {
          throw new ConflictException('The managed Android runtime changed.');
        }
        await operation();
      },
      () => controller.abort(),
    );
  }

  /** Provides the narrow Android runtime capabilities used by automations. */
  automationAdapters(canUseInternet: boolean): AndroidAutomationAdapters {
    return {
      adb: this.adb,
      display: this.display,
      networkPolicy: {
        updateNetworkPolicy: (id, input) =>
          this.network.updateNetworkPolicy(id, input, canUseInternet),
        changeAllowedCidr: (id, change) =>
          this.network.changeAllowedCidr(id, change, canUseInternet),
      },
    };
  }

  captureAutomationTarget(
    app: AndroidAutomationApplication,
    signal: AbortSignal,
  ) {
    return this.runtimeOperations.capture(app, signal);
  }

  withAutomationTarget<T>(
    expected: AndroidAutomationTarget,
    signal: AbortSignal | undefined,
    operation: (app: AndroidAutomationApplication) => Promise<T>,
  ) {
    return this.runtimeOperations.run(expected, signal, operation);
  }

  /** Starts an app container. */
  start(
    id: string,
    dto: StartAndroidApplicationDto = {},
    maxOpenApps?: number,
  ): Promise<AndroidApplication> {
    return this.lifecycle.start(id, dto, maxOpenApps);
  }
}
