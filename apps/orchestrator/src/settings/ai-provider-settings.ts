import { BadRequestException } from '@nestjs/common';
import {
  MASKED_API_KEY,
  defaultAiProviders,
  maskProvider,
  normalizeAiModel as normalizeAiModelCore,
  normalizeAiModelSettings,
  normalizeAiModels,
  normalizeAiProvider as normalizeAiProviderCore,
  normalizeAiProviders,
  normalizeDefaultModel,
  resolveUpdatedApiKey,
  text,
  type AutomationAiProvider,
} from '@rebroid/ai-core/provider';

const asBadRequest = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error
        ? error.message
        : 'AI provider configuration is invalid.',
    );
  }
};

const normalizeAiProvider = (
  rawProvider: unknown,
  fallback?: AutomationAiProvider,
) => asBadRequest(() => normalizeAiProviderCore(rawProvider, fallback));

const normalizeAiModel = (rawModel: unknown) =>
  asBadRequest(() => normalizeAiModelCore(rawModel));

export {
  MASKED_API_KEY,
  defaultAiProviders,
  maskProvider,
  normalizeAiModel,
  normalizeAiModelSettings,
  normalizeAiModels,
  normalizeAiProvider,
  normalizeAiProviders,
  normalizeDefaultModel,
  resolveUpdatedApiKey,
  text,
};
