import type { ChatMessage } from '../../common/ai-provider-request';
import type { AutomationAiProviderModelRole } from '../contracts/ai-provider';

export const modelRoleLabel = (role: AutomationAiProviderModelRole) => {
  if (role === 'controller') return 'Controller';
  if (role === 'planner') return 'Planner';
  return 'Vision';
};

export const modelRoleProbeMessages = (
  role: AutomationAiProviderModelRole,
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
  if (role === 'controller') {
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
) => {
  const root = record(body);
  if (!root) {
    return `${modelRoleLabel(role)} role check returned an invalid JSON body.`;
  }
  const choice = Array.isArray(root.choices) ? root.choices[0] : null;
  const message = record(record(choice)?.message) ?? record(root.message);
  if (!message) {
    return `${modelRoleLabel(role)} role check returned no assistant message.`;
  }
  if (role === 'controller') {
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    const hasExpectedCall = calls.some(
      (call) => record(record(call)?.function)?.name === 'health_check_noop',
    );
    return hasExpectedCall
      ? null
      : 'Controller role check did not produce the required structured tool call.';
  }

  const content =
    typeof message.content === 'string' ? message.content.trim() : '';
  if (!content) {
    const reasoning =
      typeof message.reasoning_content === 'string'
        ? message.reasoning_content.trim()
        : typeof message.thinking === 'string'
          ? message.thinking.trim()
          : '';
    return reasoning
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

export const aiProviderErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Provider health check failed.';
  const cause = record(error.cause);
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

const record = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
