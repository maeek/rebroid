import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import type { AutomationAiProviderModelRole } from '../../settings/contracts/ai-provider';

@Injectable()
export class AutomationAiProviderService {
  constructor(
    private readonly settings: SettingsService,
    private readonly features: FeatureFlagsService,
  ) {}

  async listProviders() {
    return this.settings.listEnabledAiModelCatalog();
  }

  async getProvider(
    providerId?: string,
    modelId?: string,
    role: AutomationAiProviderModelRole = 'controller',
  ) {
    this.features.assertEnabled('feature.ai');
    return this.settings.getAiProviderForExecution(providerId, modelId, role);
  }
}
