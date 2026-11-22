import { text } from '../ai-provider-values';
import { asRecord } from '../../common/object-record';
import {
  providerAssistantMessage,
  type ChatMessage,
} from '../../common/ai-provider-request';
import type { AutomationAiProviderModelRole } from '../contracts/ai-provider';

export const modelRoleLabel = (role: AutomationAiProviderModelRole) => {
  if (role === 'controller') return 'Controller';
  if (role === 'planner') return 'Planner';
  return 'Vision';
};

export const modelRoleProbeMessages = (
  role: AutomationAiProviderModelRole,
  mode: 'tool' | 'schema' | 'text' = role === 'controller' ? 'tool' : 'text',
): ChatMessage[] => {
  if (role === 'vision') {
    return [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Reply with the single word white if the attached pixel is white.',
          },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
            },
          },
        ],
      },
    ];
  }
  if (mode === 'schema')
    return [
      { role: 'user', content: 'Reply with the JSON object {"ok":true}.' },
    ];
  if (mode === 'tool') {
    return [
      {
        role: 'user',
        content: 'Call health_check_noop now. Do not answer with prose.',
      },
    ];
  }
  return [{ role: 'user', content: 'Reply with ok.' }];
};

export const modelRoleProbeIncompatibility = (
  role: AutomationAiProviderModelRole,
  body: unknown,
  mode: 'tool' | 'schema' | 'text' = role === 'controller' ? 'tool' : 'text',
) => {
  const root = asRecord(body);
  if (!root) {
    return `${modelRoleLabel(role)} role check returned an invalid JSON body.`;
  }
  const message = providerAssistantMessage(root);
  if (!message) {
    return `${modelRoleLabel(role)} role check returned no assistant message.`;
  }
  if (mode === 'tool') {
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    const hasExpectedCall = calls.some(
      (call) =>
        asRecord(asRecord(call)?.function)?.name === 'health_check_noop',
    );
    return hasExpectedCall
      ? null
      : `${modelRoleLabel(role)} role check did not produce the required structured tool call.`;
  }

  const content = text(message.content);
  if (mode === 'schema') {
    try {
      if (asRecord(JSON.parse(content))?.ok === true) return null;
    } catch {
      // The model did not return the configured structured response.
    }
    return `${modelRoleLabel(role)} role check did not produce the required JSON response.`;
  }
  if (!content) {
    const reasoning =
      typeof message.reasoning_content === 'string'
        ? message.reasoning_content
        : message.thinking;
    return text(reasoning)
      ? `${modelRoleLabel(role)} role check returned reasoning but no public content.`
      : `${modelRoleLabel(role)} role check returned empty content.`;
  }
  if (role === 'vision' && !/white/i.test(content)) {
    return 'Vision role check did not identify the supplied white image.';
  }
  return null;
};

export const isProviderTimeoutError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    /aborted due to timeout/i.test(error.message));

export const providerDiagnosticMessage = (
  message: string,
  apiKey?: string | null,
) => (apiKey ? message.replaceAll(apiKey, '[redacted]') : message);

export const aiProviderErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Provider health check failed.';
  const cause = asRecord(error.cause);
  if (!cause) return error.message;

  const details = [
    typeof cause.message === 'string' ? cause.message : '',
    typeof cause.code === 'string' ? cause.code : '',
    typeof cause.address === 'string' ? cause.address : '',
    typeof cause.port === 'number' ? String(cause.port) : '',
  ].filter(Boolean);
  const uniqueDetails = Array.from(new Set(details));
  return uniqueDetails.length > 0
    ? `${error.message}: ${uniqueDetails.join(' ')}`
    : error.message;
};
