import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ANDROID_APPS_AUTOMATION,
  type AndroidAppsAutomationPort,
} from '../../android-apps/contracts/android-apps-automation.port';

@Injectable()
export class AutomationTargetApplicationService {
  constructor(
    @Inject(ANDROID_APPS_AUTOMATION)
    private readonly apps: AndroidAppsAutomationPort,
  ) {}

  async assertOwnerAccess(ownerUserId: string, id?: string | null) {
    if (!id) {
      throw new BadRequestException('targetApplicationId is required.');
    }
    const app = await this.apps.get(id);
    if (app.ownerUserId !== ownerUserId) {
      throw new NotFoundException(`Application "${id}" was not found.`);
    }
  }
}
