import { createHash } from 'node:crypto';
import { z } from 'zod';
import { readBoundedProviderText } from './ai-provider-http';
import type { AutomationAiProvider } from '../settings/contracts/ai-provider';

export const openAiBillingCodes = [
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'insufficient_quota',
] as const;

type OpenAiBillingCode = (typeof openAiBillingCodes)[number];

interface OpenAiBillingIssue {
  code: OpenAiBillingCode;
  observedAt: string;
}

const billingCodes = z.enum(openAiBillingCodes);
const errorFields = z.object({
  code: z.unknown().optional(),
  type: z.unknown().optional(),
});
const errorEnvelope = z.object({ error: errorFields });
const billingIssues = new Map<string, OpenAiBillingIssue>();
const maximumBillingIssues = 256;

const connectionKey = (provider: AutomationAiProvider) =>
  createHash('sha256')
    .update(JSON.stringify([provider.id, provider.baseUrl, provider.apiKey]))
    .digest('hex');

export const getOpenAiBillingIssue = (provider: AutomationAiProvider) =>
  billingIssues.get(connectionKey(provider));

const recordBillingIssue = (key: string, code: OpenAiBillingCode) => {
  billingIssues.delete(key);
  billingIssues.set(key, { code, observedAt: new Date().toISOString() });
  const oldest = billingIssues.keys().next().value;
  if (billingIssues.size > maximumBillingIssues && oldest !== undefined) {
    billingIssues.delete(oldest);
  }
};

export const openAiBillingError = (value: unknown) => {
  const envelope = errorEnvelope.safeParse(value);
  const fields = errorFields.safeParse(
    envelope.success ? envelope.data.error : value,
  );
  if (!fields.success) return undefined;
  const code = billingCodes.safeParse(fields.data.code);
  if (code.success) return new OpenAiBillingError(code.data);
  if (fields.data.type === 'insufficient_quota') {
    return new OpenAiBillingError('insufficient_quota');
  }
};

class OpenAiBillingError extends Error {
  constructor(readonly code: OpenAiBillingCode) {
    super(`OpenAI rejected the model request (${code}).`);
  }
}

const readBillingError = async (response: Response) => {
  try {
    const text = await readBoundedProviderText(response.clone(), 8_192);
    return openAiBillingError(JSON.parse(text) as unknown);
  } catch {
    // The request's original consumer handles malformed bodies and read failures.
    return undefined;
  }
};

export const observeOpenAiBilling =
  <T>(
    provider: AutomationAiProvider,
    consume: (response: Response) => Promise<T>,
  ) =>
  async (response: Response) => {
    const key = connectionKey(provider);
    if (response.status === 429) {
      const error = await readBillingError(response);
      if (error) recordBillingIssue(key, error.code);
    }
    try {
      const result = await consume(response);
      if (response.ok) billingIssues.delete(key);
      return result;
    } catch (error) {
      if (error instanceof OpenAiBillingError)
        recordBillingIssue(key, error.code);
      throw error;
    }
  };
