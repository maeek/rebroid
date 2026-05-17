import { Injectable } from '@nestjs/common';
import { AndroidApplication } from '../android-application.entity';
import { CreateAndroidApplicationDto } from '../dto/create-android-application.dto';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from '../dto/remove-android-application.dto';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { UpdateAndroidApplicationDto } from '../dto/update-android-application.dto';
import { UpdateNetworkPolicyDto } from '../dto/update-network-policy.dto';
import { AndroidAppsOperationsService } from './android-apps-operations.service';
import { AndroidAppsStateService } from './android-apps-state.service';

@Injectable()
export class AndroidAppsFacadeService {
  constructor(
    private readonly operations: AndroidAppsOperationsService,
    private readonly state: AndroidAppsStateService,
  ) {}

  create(dto: CreateAndroidApplicationDto): Promise<AndroidApplication> {
    return this.operations.create(dto);
  }

  list(query: ListAndroidApplicationsDto): Promise<AndroidApplication[]> {
    return this.state.list(query);
  }

  get(id: string): Promise<AndroidApplication> {
    return this.state.get(id);
  }

  update(
    id: string,
    dto: UpdateAndroidApplicationDto,
  ): Promise<AndroidApplication> {
    return this.operations.update(id, dto);
  }

  updateNetworkPolicy(
    id: string,
    dto: UpdateNetworkPolicyDto,
  ): Promise<AndroidApplication> {
    return this.operations.updateNetworkPolicy(id, dto);
  }

  applyNetworkPolicy(id: string): Promise<AndroidApplication> {
    return this.operations.applyNetworkPolicy(id);
  }

  switchProfile(
    id: string,
    dto: SwitchApplicationProfileDto,
  ): Promise<AndroidApplication> {
    return this.operations.switchProfile(id, dto);
  }

  start(
    id: string,
    dto: StartAndroidApplicationDto = {},
  ): Promise<AndroidApplication> {
    return this.operations.start(id, dto);
  }

  stop(id: string): Promise<AndroidApplication> {
    return this.operations.stop(id);
  }

  updateApk(
    id: string,
    dto: UpdateAndroidApplicationApkDto,
  ): Promise<AndroidApplication> {
    return this.operations.updateApk(id, dto);
  }

  remove(id: string, query: RemoveAndroidApplicationDto) {
    return this.operations.remove(id, query);
  }

  scrcpySession(id: string): Promise<ScrcpySessionDto> {
    return this.operations.scrcpySession(id);
  }

  recordViewerActivity(id: string) {
    return this.operations.recordViewerActivity(id);
  }

  notifications(id: string) {
    return this.operations.notifications(id);
  }

  containerLogs(id: string, tail = 300) {
    return this.operations.containerLogs(id, tail);
  }

  adbLogs(id: string, tail = 300) {
    return this.operations.adbLogs(id, tail);
  }

  findInactiveRunningApplications(now = new Date()) {
    return this.state.findInactiveRunningApplications(now);
  }
}