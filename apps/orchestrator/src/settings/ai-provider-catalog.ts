import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AutomationAiProvider } from './contracts/ai-provider';
import type { StoredOrchestratorSettings } from './orchestrator-settings-store';

export function requireAiProvider(
  settings: StoredOrchestratorSettings,
  id: string,
) {
  const provider = settings.aiProviders.find((item) => item.id === id);
  if (!provider)
    throw new NotFoundException(`AI provider "${id}" was not found.`);
  return provider;
}

export function replaceAiProvider(
  settings: StoredOrchestratorSettings,
  id: string,
  update: (provider: AutomationAiProvider) => AutomationAiProvider,
) {
  const current = requireAiProvider(settings, id);
  const next = update(current);
  if (
    next.id !== id &&
    settings.aiProviders.some((provider) => provider.id === next.id)
  ) {
    throw new BadRequestException(`AI provider "${next.id}" already exists.`);
  }
  return {
    ...settings,
    aiProviders: settings.aiProviders.map((provider) =>
      provider === current ? next : provider,
    ),
  };
}
