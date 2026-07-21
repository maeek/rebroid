import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import type { AutomationAiProviderModelRole } from '../../settings/contracts/ai-provider';

@Injectable()
export class AutomationAiProviderService {
  constructor(private readonly settings: SettingsService) {}

  async listProviders() {
    return this.settings.listEnabledAiModelCatalog();
  }

  async getProvider(
    providerId?: string,
    modelId?: string,
    role: AutomationAiProviderModelRole = 'controller',
  ) {
    return this.settings.getAiProviderForExecution(providerId, modelId, role);
  }
}
