import { Injectable } from '@nestjs/common';
import { CloneAndroidApplicationDto } from '../../common/dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../../common/dto/create-android-application.dto';
import { RemoveAndroidApplicationDto } from '../../common/dto/remove-android-application.dto';
import { UpdateAndroidApplicationDto } from '../../common/dto/update-android-application.dto';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { AndroidAppsConfigurationService } from './android-apps-configuration.service';
import { AndroidAppsPowerService } from './android-apps-power.service';
import { AndroidAppsRemovalService } from './android-apps-removal.service';

@Injectable()
export class AndroidAppsLifecycleService {
  constructor(
    private readonly configuration: AndroidAppsConfigurationService,
    private readonly power: AndroidAppsPowerService,
    private readonly removal: AndroidAppsRemovalService,
  ) {}

  create(dto: CreateAndroidApplicationDto) {
    return this.configuration.create(dto);
  }

  clone(id: string, dto: CloneAndroidApplicationDto) {
    return this.configuration.clone(id, dto);
  }

  update(id: string, dto: UpdateAndroidApplicationDto) {
    return this.configuration.update(id, dto);
  }

  switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    return this.configuration.switchProfile(id, dto);
  }

  deleteSavedProfile(id: string, profileName: string) {
    return this.configuration.deleteSavedProfile(id, profileName);
  }

  start(id: string, dto: StartAndroidApplicationDto = {}) {
    return this.power.start(id, dto);
  }

  stop(
    id: string,
    options: { reason?: string; details?: Record<string, unknown> } = {},
  ) {
    return this.power.stop(id, options);
  }

  updateApk(id: string, dto: UpdateAndroidApplicationApkDto) {
    return this.configuration.updateApk(id, dto);
  }

  remove(id: string, query: RemoveAndroidApplicationDto) {
    return this.removal.request(id, query);
  }
}
