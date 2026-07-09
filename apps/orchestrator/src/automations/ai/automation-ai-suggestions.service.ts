import { Injectable, Logger } from '@nestjs/common';
import { type ChatMessage } from '@rebroid/ai-core/harness';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { textContent } from './automation-ai-message.utils';
import type {
  AiPromptSuggestionDto,
  SuggestAdHocAiPromptsDto,
} from '../dto/automation-run.dto';

@Injectable()
export class AutomationAiSuggestionsService {
  private readonly logger = new Logger(AutomationAiSuggestionsService.name);

  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly chatClient: AutomationAiChatClientService,
  ) {}

  async suggest(dto: SuggestAdHocAiPromptsDto) {
    const fallback = fallbackSuggestions(dto);
    try {
      const { provider, model } = await this.providers.getProvider(
        dto.providerId,
        dto.modelId,
        'planner',
      );
      const response = await this.chatClient.chat({
        provider,
        model,
        messages: suggestionMessages(dto),
        tools: [],
        deadline: Date.now() + 20_000,
      });
      const content = textContent(response.choices?.[0]?.message?.content);
      const suggestions = parseSuggestions(content);
      return {
        suggestions: suggestions.length > 0 ? suggestions : fallback,
      };
    } catch (error) {
      this.logger.debug(
        `AI prompt suggestions fell back: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { suggestions: fallback };
    }
  }
}

const suggestionMessages = (dto: SuggestAdHocAiPromptsDto): ChatMessage[] => [
  {
    role: 'system',
    content: [
      'You generate concise Android automation prompt suggestions for a visible AI agent chat.',
      'Return JSON only, no markdown, no prose outside JSON.',
      'JSON shape: {"suggestions":[{"label":"short label","prompt":"concrete prompt"}]}.',
      'Create 3 to 5 suggestions. Labels must be plain text, 2 to 5 words, no markdown, and 36 characters or shorter. Prompts must be actionable and 500 characters or shorter.',
      'Use concrete Android actions. Avoid vague QA labels such as "smoke test", "verify login", or "capture flow" unless the current app context specifically asks for that.',
      'Use the current app, recent conversation, recent run events, and allowed tools. Do not invent device state.',
      'If the context mentions a device/system/platform task, suggest Android system routes before asking for a custom app.',
    ].join('\n'),
  },
  {
    role: 'user',
    content: JSON.stringify({
      app: {
        id: dto.targetApplicationId,
        name: dto.appName,
        profileMode: dto.profileMode ?? null,
        profileName: dto.profileName ?? null,
      },
      currentPrompt: dto.currentPrompt ?? '',
      allowedTools: (dto.allowedTools ?? []).slice(0, 40),
      conversation: (dto.conversation ?? []).slice(-8),
      recentEvents: (dto.recentEvents ?? []).slice(-20),
    }),
  },
];

const parseSuggestions = (text: string): AiPromptSuggestionDto[] => {
  const parsed = parseJsonObject(extractJsonObject(text));
  const record =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const rawSuggestions = Array.isArray(record.suggestions)
    ? record.suggestions
    : Array.isArray(parsed)
      ? parsed
      : [];
  const suggestions = rawSuggestions.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const label = sanitizeSuggestionLabel(record.label, index);
    const prompt = sanitizeSuggestionText(record.prompt, 500);
    if (!label || !prompt) return [];
    return [
      {
        id: suggestionId(label, index),
        label,
        prompt,
      },
    ];
  });
  return dedupeSuggestions(suggestions).slice(0, 5);
};

const fallbackSuggestions = (
  dto: Pick<SuggestAdHocAiPromptsDto, 'appName'>,
): AiPromptSuggestionDto[] => [
  {
    id: 'inspect-screen',
    label: 'Inspect screen',
    prompt: `Inspect the current screen in ${dto.appName}. Report the visible app/screen, available controls, and the safest confirmed next action without guessing unlabeled icons.`,
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    prompt:
      'Open Android system Settings using confirmed package or Settings intent routes, observe the result, and report the visible settings screen.',
  },
  {
    id: 'find-package',
    label: 'Find package',
    prompt:
      'List installed Android packages with a narrow query related to the task, then explain which package or route is confirmed.',
  },
  {
    id: 'read-screen-text',
    label: 'Read screen text',
    prompt: `Extract the important visible text from ${dto.appName}. Group labels, values, alerts, and navigation items.`,
  },
  {
    id: 'navigate-safely',
    label: 'Navigate safely',
    prompt:
      'Use the latest observation to choose one confirmed navigation action, execute it, observe again, and stop if the expected screen is not reached.',
  },
];

const sanitizeSuggestionText = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? sanitizeAiText(value, maxLength).trim() : '';

const sanitizeSuggestionLabel = (value: unknown, index: number) => {
  const raw = typeof value === 'string' ? value : '';
  const label = raw
    .replace(/\[truncated\s+\d+\s+chars?\]/gi, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const fallback = `Suggestion ${index + 1}`;
  const normalized = label || fallback;
  return normalized.length > 36
    ? `${normalized.slice(0, 35).trimEnd()}…`
    : normalized;
};

const suggestionId = (label: string, index: number) => {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id || `suggestion-${index + 1}`;
};

const dedupeSuggestions = (suggestions: AiPromptSuggestionDto[]) => {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = suggestion.prompt.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractJsonObject = (text: string) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }
  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  return arrayStart >= 0 && arrayEnd > arrayStart
    ? trimmed.slice(arrayStart, arrayEnd + 1)
    : trimmed;
};

const parseJsonObject = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};
