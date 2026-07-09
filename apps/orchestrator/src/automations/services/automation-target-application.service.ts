import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AndroidAppsFacadeService } from '../../android-apps/common/services/android-apps-facade.service';

@Injectable()
export class AutomationTargetApplicationService {
  constructor(private readonly apps: AndroidAppsFacadeService) {}

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
