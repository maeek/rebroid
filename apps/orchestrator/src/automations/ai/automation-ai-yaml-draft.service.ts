import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { modelSupportsTools } from '../../common/ai-provider-request';
import {
  AUTOMATION_DRAFT_TIMEOUT_MS,
  type AutomationYamlDraftStreamEvent,
} from '@rebroid/automation-core/yaml-draft';
import { DraftAutomationYamlDto } from '../dto/automation.dto';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import {
  addYamlRepairFeedback,
  assertDraftUsesAllowedCommands,
  buildYamlDraftMessages,
  extractDraftClarification,
  extractSubmittedYaml,
  requestClarificationTool,
  submitYamlTool,
  yamlRepairMessage,
} from './automation-ai-yaml-draft';

const MAX_DRAFT_ATTEMPTS = 3;

@Injectable()
export class AutomationAiYamlDraftService {
  private readonly logger = new Logger(AutomationAiYamlDraftService.name);

  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly definitions: AutomationDefinitionService,
    private readonly chatClient: AutomationAiChatClientService,
  ) {}

  async *draftEvents(
    dto: DraftAutomationYamlDto,
    options: { abortSignal?: AbortSignal } = {},
  ): AsyncGenerator<AutomationYamlDraftStreamEvent> {
    try {
      yield* this.runDraftEvents(dto, options);
    } catch (error) {
      const message = this.errorMessage(error);
      const status = error instanceof HttpException ? error.getStatus() : 500;
      this.logger.warn(`AI YAML draft failed: ${message}`);
      yield {
        type: 'draft.failed',
        message,
        data: { status },
      };
    }
  }

  private async *runDraftEvents(
    dto: DraftAutomationYamlDto,
    { abortSignal }: { abortSignal?: AbortSignal },
  ): AsyncGenerator<AutomationYamlDraftStreamEvent> {
    yield {
      type: 'draft.started',
      message: 'Preparing automation draft context.',
      data: { maxAttempts: MAX_DRAFT_ATTEMPTS },
    };
    const { provider, model } = await this.providers.getProvider(
      dto.providerId,
      dto.modelId,
      'planner',
    );
    yield {
      type: 'draft.model.started',
      message: `Using ${provider.label}`,
      data: { providerId: provider.id, modelId: model.id },
    };

    const commands = this.availableCommands(dto.allowedTools);
    if (commands.length === 0) {
      throw new BadRequestException(
        'No automation commands are available for this draft.',
      );
    }
    const deadline = Date.now() + AUTOMATION_DRAFT_TIMEOUT_MS;
    const messages = buildYamlDraftMessages({
      prompt: dto.prompt,
      commands,
      modelSystemPrompt: model.settings.systemPrompt,
      clarifications: dto.clarifications,
    });
    let lastError = 'AI provider did not submit automation YAML.';

    for (let attempt = 1; attempt <= MAX_DRAFT_ATTEMPTS; attempt += 1) {
      yield {
        type: 'draft.phase',
        message:
          attempt === 1
            ? 'Generating workflow YAML.'
            : 'Regenerating workflow YAML with validation feedback.',
        data: { attempt, phase: 'generating' },
      };
      const response = yield* this.chatWithStreamEvents({
        provider,
        model,
        messages,
        deadline,
        abortSignal,
        attempt,
      });
      const message = response.choices?.[0]?.message;
      if (!message) {
        lastError = 'AI provider returned no message.';
        yield {
          type: 'draft.validation.failed',
          message: lastError,
          data: { attempt },
        };
        messages.push(yamlRepairMessage(lastError));
        continue;
      }

      const clarification = extractDraftClarification(message);
      if (clarification) {
        yield {
          type: 'draft.clarification.requested',
          message: clarification,
          data: { question: clarification },
        };
        return;
      }

      const candidate = extractSubmittedYaml(message);
      messages.push(message);
      try {
        yield {
          type: 'draft.phase',
          message: 'Validating generated YAML.',
          data: { attempt, phase: 'validating' },
        };
        if (!candidate) {
          throw new BadRequestException(
            'Response did not include submitted automation YAML.',
          );
        }
        const definition = this.definitions.parseYaml(candidate);
        assertDraftUsesAllowedCommands(definition, commands);
        const draft = {
          definition,
          yaml: this.definitions.toYaml(definition),
        };
        yield {
          type: 'draft.completed',
          message: 'Automation draft is ready.',
          data: draft,
        };
        return;
      } catch (error) {
        lastError =
          error instanceof Error ? sanitizeAiText(error.message) : lastError;
        yield {
          type: 'draft.validation.failed',
          message: lastError,
          data: { attempt },
        };
        addYamlRepairFeedback(messages, message, lastError);
        if (attempt === MAX_DRAFT_ATTEMPTS) break;
        yield {
          type: 'draft.repair.started',
          message: 'Asking the model to repair the draft.',
          data: { attempt, nextAttempt: attempt + 1 },
        };
      }
    }

    throw new BadRequestException(
      `AI draft did not produce valid automation YAML: ${lastError}`,
    );
  }

  private async *chatWithStreamEvents({
    provider,
    model,
    messages,
    deadline,
    abortSignal,
    attempt,
  }: {
    provider: Parameters<AutomationAiChatClientService['chat']>[0]['provider'];
    model: Parameters<AutomationAiChatClientService['chat']>[0]['model'];
    messages: Parameters<AutomationAiChatClientService['chat']>[0]['messages'];
    deadline: number;
    abortSignal?: AbortSignal;
    attempt: number;
  }): AsyncGenerator<
    AutomationYamlDraftStreamEvent,
    Awaited<ReturnType<AutomationAiChatClientService['chat']>>
  > {
    const pending: AutomationYamlDraftStreamEvent[] = [];
    const scope = new AbortController();
    const signal = abortSignal
      ? AbortSignal.any([abortSignal, scope.signal])
      : scope.signal;
    let releaseProgress: (() => void) | undefined;
    let wake: (() => void) | null = null;
    let finished = false;
    let result: Awaited<
      ReturnType<AutomationAiChatClientService['chat']>
    > | null = null;
    let failure: unknown = null;
    const notify = () => {
      wake?.();
      wake = null;
    };
    const wait = () =>
      new Promise<void>((resolve) => {
        wake = resolve;
      });

    void this.chatClient
      .chat({
        role: 'planner',
        provider,
        model,
        messages,
        tools: modelSupportsTools(model)
          ? [submitYamlTool(), requestClarificationTool()]
          : [],
        deadline,
        abortSignal: signal,
        onContentDelta: async (delta) => {
          signal.throwIfAborted();
          const consumed = new Promise<void>((resolve) => {
            releaseProgress = resolve;
          });
          pending.push({
            type: 'draft.message.delta',
            message: delta,
            data: { attempt },
          });
          notify();
          await consumed;
        },
      })
      .then((response) => {
        result = response;
      })
      .catch((error) => {
        failure = error;
      })
      .finally(() => {
        finished = true;
        notify();
      });

    try {
      while (!finished || pending.length > 0) {
        while (pending.length > 0) {
          const event = pending.shift();
          if (event) yield event;
          releaseProgress?.();
          releaseProgress = undefined;
        }
        if (!finished) await wait();
      }
    } finally {
      scope.abort();
      releaseProgress?.();
    }

    if (failure) throw failure;
    if (!result) {
      throw new BadRequestException('AI provider returned no message.');
    }
    return result;
  }

  private availableCommands(allowedTools?: string[]) {
    const allowed =
      allowedTools === undefined ? null : new Set(allowedTools.filter(Boolean));
    return this.registry
      .listCommands()
      .filter((command) => command.uses !== 'ai.run')
      .filter((command) => !allowed || allowed.has(command.uses));
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return sanitizeAiText(error.message);
    }
    return 'AI draft generation failed.';
  }
}
