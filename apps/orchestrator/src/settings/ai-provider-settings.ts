import { BadRequestException } from '@nestjs/common';
import { defaultAiProviders, MASKED_API_KEY } from './ai-provider-defaults';
import { normalizeDefaultModel } from './ai-provider-default-model';
import {
  maskProvider,
  normalizeAiModel as normalizeAiModelCore,
  normalizeAiProvider as normalizeAiProviderCore,
  normalizeAiProviders,
  resolveUpdatedApiKey,
} from './ai-provider-normalization';
import { text } from './ai-provider-values';
import type { AutomationAiProvider } from './contracts/ai-provider';

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
  normalizeAiProvider,
  normalizeAiProviders,
  normalizeDefaultModel,
  resolveUpdatedApiKey,
  text,
};
