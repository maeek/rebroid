import { Injectable } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import type { BufferedUploadFile } from '../../../common/http-upload';
import { CloneAndroidApplicationDto } from '../dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../dto/create-android-application.dto';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from '../dto/remove-android-application.dto';
import { UpdateAndroidApplicationDto } from '../dto/update-android-application.dto';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { StartAndroidApplicationDto } from '../../lifecycle/dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../../lifecycle/dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../../lifecycle/dto/update-android-application-apk.dto';
import { AndroidAppsNetworkPolicyService } from '../../network/services/android-apps-network-policy.service';
import { UpdateNetworkPolicyDto } from '../../network/dto/update-network-policy.dto';
import { AndroidAppsRuntimeAccessService } from '../../runtime/services/android-apps-runtime-access.service';
import type { ApplicationViewerControlCommand } from '../../viewer/dto/application-viewer-control.dto';
import { ScrcpySessionDto } from '../../viewer/dto/scrcpy-session.dto';
import { AndroidAppsStateService } from './android-apps-state.service';
import { AndroidAppsViewerService } from '../../viewer/services/android-apps-viewer.service';

@Injectable()
export class AndroidAppsFacadeService {
  constructor(
    private readonly lifecycle: AndroidAppsLifecycleService,
    private readonly network: AndroidAppsNetworkPolicyService,
    private readonly runtime: AndroidAppsRuntimeAccessService,
    private readonly state: AndroidAppsStateService,
    private readonly viewer: AndroidAppsViewerService,
  ) {}

  /** Creates a new app record and starts setup. */
  create(dto: CreateAndroidApplicationDto): Promise<AndroidApplication> {
    return this.lifecycle.create(dto);
  }

  /** Creates a copy of an existing app. */
  clone(
    id: string,
    dto: CloneAndroidApplicationDto,
  ): Promise<AndroidApplication> {
    return this.lifecycle.clone(id, dto);
  }

  /** Lists apps for the current query. */
  list(query: ListAndroidApplicationsDto): Promise<AndroidApplication[]> {
    return this.state.list(query);
  }

  /** Loads one app. */
  get(id: string): Promise<AndroidApplication> {
    return this.state.get(id);
  }

  /** Updates app settings. */
  update(
    id: string,
    dto: UpdateAndroidApplicationDto,
  ): Promise<AndroidApplication> {
    return this.lifecycle.update(id, dto);
  }

  /** Saves network policy settings for an app. */
  updateNetworkPolicy(
    id: string,
    dto: UpdateNetworkPolicyDto,
  ): Promise<AndroidApplication> {
    return this.network.updateNetworkPolicy(id, dto);
  }

  /** Reapplies the network policy for an app. */
  applyNetworkPolicy(id: string): Promise<AndroidApplication> {
    return this.network.applyNetworkPolicy(id);
  }

  /** Switches the active profile for an app. */
  switchProfile(
    id: string,
    dto: SwitchApplicationProfileDto,
  ): Promise<AndroidApplication> {
    return this.lifecycle.switchProfile(id, dto);
  }

  /** Starts an app container. */
  start(
    id: string,
    dto: StartAndroidApplicationDto = {},
  ): Promise<AndroidApplication> {
    return this.lifecycle.start(id, dto);
  }

  /** Stops an app container. */
  stop(
    id: string,
    options: { reason?: string; details?: Record<string, unknown> } = {},
  ): Promise<AndroidApplication> {
    return this.lifecycle.stop(id, options);
  }

  /** Replaces the APK used by an app. */
  updateApk(
    id: string,
    dto: UpdateAndroidApplicationApkDto,
  ): Promise<AndroidApplication> {
    return this.lifecycle.updateApk(id, dto);
  }

  /** Removes an app and its runtime resources. */
  remove(id: string, query: RemoveAndroidApplicationDto) {
    return this.lifecycle.remove(id, query);
  }

  /** Builds scrcpy session details for an app. */
  scrcpySession(id: string): Promise<ScrcpySessionDto> {
    return this.viewer.scrcpySession(id);
  }

  /** Updates the last viewer activity time. */
  recordViewerActivity(id: string) {
    return this.viewer.recordViewerActivity(id);
  }

  /** Reads recent Android notifications. */
  notifications(id: string) {
    return this.runtime.notifications(id);
  }

  /** Reads recent container logs. */
  containerLogs(id: string, tail = 300) {
    return this.runtime.containerLogs(id, tail);
  }

  /** Reads recent orchestrator event logs. */
  eventLogs(id: string, tail = 300) {
    return this.runtime.eventLogs(id, tail);
  }

  /** Reads recent Android log output. */
  adbLogs(id: string, tail = 300) {
    return this.runtime.adbLogs(id, tail);
  }

  /** Lists files in the Download folder. */
  listDownloadFiles(id: string) {
    return this.runtime.listDownloadFiles(id);
  }

  /** Uploads one file into the Download folder. */
  uploadDownloadFile(id: string, file?: BufferedUploadFile) {
    const app = this.state.get(id);
    return app.then((storedApp) =>
      this.runtime.uploadDownloadFileBuffer(storedApp, file),
    );
  }

  /** Downloads one file from the Download folder. */
  downloadFile(id: string, fileName: string) {
    return this.runtime.downloadFile(id, fileName);
  }

  /** Reads the Android clipboard text. */
  getClipboard(id: string) {
    return this.runtime.getClipboard(id);
  }

  /** Writes text to the Android clipboard. */
  setClipboard(id: string, text: string) {
    return this.runtime.setClipboard(id, text);
  }

  /** Captures a screenshot from the app. */
  screenshot(id: string) {
    return this.runtime.screenshot(id);
  }

  /** Sends one viewer control command. */
  viewerControl(id: string, command: ApplicationViewerControlCommand) {
    return this.viewer.viewerControl(id, command);
  }

  /** Finds running apps that have been idle too long. */
  findInactiveRunningApplications(now = new Date()) {
    return this.state.findInactiveRunningApplications(now);
  }
}
