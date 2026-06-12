import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AndroidAppsStateService } from '../../android-apps/common/services/android-apps-state.service';

@Injectable()
export class AutomationTargetApplicationService {
  constructor(private readonly apps: AndroidAppsStateService) {}

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
