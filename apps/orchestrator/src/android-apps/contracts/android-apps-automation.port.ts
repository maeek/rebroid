import type { AndroidApplication } from '../android-application.entity';
import type { UpdateNetworkPolicyDto } from '../network/dto/update-network-policy.dto';
import type { AndroidAppsDisplaySidecarService } from '../viewer/services/android-apps-display-sidecar.service';
import type { AndroidAppsSidecarAdbService } from '../viewer/services/android-apps-sidecar-adb.service';

export type AndroidAutomationApplication = AndroidApplication;

export type AndroidAutomationAdbPort = Pick<
  AndroidAppsSidecarAdbService,
  keyof AndroidAppsSidecarAdbService
>;

export type AndroidAutomationDisplayPort = Pick<
  AndroidAppsDisplaySidecarService,
  keyof AndroidAppsDisplaySidecarService
>;

export interface AndroidAutomationNetworkPolicyPort {
  updateNetworkPolicy(
    id: string,
    dto: UpdateNetworkPolicyDto,
  ): Promise<AndroidApplication>;
}

export interface AndroidAutomationAdapters {
  adb: AndroidAutomationAdbPort;
  display: AndroidAutomationDisplayPort;
  networkPolicy: AndroidAutomationNetworkPolicyPort;
}
