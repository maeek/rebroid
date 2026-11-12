import { ConflictException, Injectable } from '@nestjs/common';
import { CloneAndroidApplicationDto } from '../../common/dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../../common/dto/create-android-application.dto';
import { RemoveAndroidApplicationDto } from '../../common/dto/remove-android-application.dto';
import { UpdateAndroidApplicationDto } from '../../common/dto/update-android-application.dto';
import { AndroidAppsRuntimeOperationGate } from '../../common/services/android-apps-runtime-operation-gate.service';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import type { ApplicationImageAccess } from '../utils/application-image-access';
import { AndroidAppsConfigurationService } from './android-apps-configuration.service';
import { AndroidAppsPowerService } from './android-apps-power.service';
import { AndroidAppsRemovalService } from './android-apps-removal.service';

@Injectable()
export class AndroidAppsLifecycleService {
  private readonly pendingCommands = new Set<string>();

  constructor(
    private readonly configuration: AndroidAppsConfigurationService,
    private readonly power: AndroidAppsPowerService,
    private readonly removal: AndroidAppsRemovalService,
    private readonly runtimeOperations: AndroidAppsRuntimeOperationGate,
  ) {}

  create(
    dto: CreateAndroidApplicationDto,
    maxOpenApps?: number,
    imageAccess?: ApplicationImageAccess,
  ) {
    return this.configuration.create(dto, maxOpenApps, imageAccess);
  }

  clone(
    id: string,
    dto: CloneAndroidApplicationDto,
    maxOpenApps?: number,
    imageAccess?: ApplicationImageAccess,
  ) {
    return this.configuration.clone(id, dto, maxOpenApps, imageAccess);
  }

  update(id: string, dto: UpdateAndroidApplicationDto) {
    return this.runCommand(id, () => this.configuration.update(id, dto));
  }

  switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    return this.runRuntimeCommand(id, () =>
      this.configuration.switchProfile(id, dto),
    );
  }

  deleteSavedProfile(id: string, profileName: string) {
    return this.runCommand(id, () =>
      this.configuration.deleteSavedProfile(id, profileName),
    );
  }

  start(
    id: string,
    dto: StartAndroidApplicationDto = {},
    maxOpenApps?: number,
  ) {
    return this.runRuntimeCommand(id, () =>
      this.power.start(id, dto, maxOpenApps),
    );
  }

  recreate(id: string, maxOpenApps?: number) {
    return this.runRuntimeCommand(id, () =>
      this.power.recreate(id, maxOpenApps),
    );
  }

  stop(
    id: string,
    options: { reason?: string; details?: Record<string, unknown> } = {},
  ) {
    return this.runRuntimeCommand(id, () => this.power.stop(id, options));
  }

  updateApk(id: string, dto: UpdateAndroidApplicationApkDto) {
    return this.runCommand(id, () => this.configuration.updateApk(id, dto));
  }

  remove(id: string, query: RemoveAndroidApplicationDto) {
    return this.runRuntimeCommand(id, () => this.removal.request(id, query));
  }

  private runRuntimeCommand<T>(id: string, operation: () => Promise<T>) {
    return this.runCommand(id, () =>
      this.runtimeOperations.interrupt(id, operation),
    );
  }

  private async runCommand<T>(id: string, operation: () => Promise<T>) {
    if (this.pendingCommands.has(id)) {
      throw new ConflictException(
        'Another application command is being processed.',
      );
    }
    this.pendingCommands.add(id);
    try {
      return await operation();
    } finally {
      this.pendingCommands.delete(id);
    }
  }
}
