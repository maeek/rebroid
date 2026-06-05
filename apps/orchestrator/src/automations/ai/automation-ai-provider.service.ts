import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class AutomationAiProviderService {
  constructor(private readonly settings: SettingsService) {}

  async listProviders() {
    return this.settings.listEnabledAiModelCatalog();
  }

  async getProvider(providerId?: string, modelId?: string) {
    return this.settings.getAiProviderForExecution(providerId, modelId);
  }
}
