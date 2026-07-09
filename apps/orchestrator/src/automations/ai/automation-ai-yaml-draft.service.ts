import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { parseArguments, type ChatMessage } from '@rebroid/ai-core/harness';
import type {
  AutomationDefinition,
  AutomationDefinitionStep,
} from '@rebroid/automation-core/definition';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import { DraftAutomationYamlDto } from '../dto/automation.dto';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import { textContent } from './automation-ai-message.utils';

const DRAFT_TIMEOUT_MS = 120_000;
const MAX_DRAFT_ATTEMPTS = 3;
const SUBMIT_YAML_TOOL_NAME = 'submitAutomationYaml';
const REQUEST_CLARIFICATION_TOOL_NAME = 'requestDraftClarification';

interface AutomationYamlDraftPayload {
  yaml: string;
  definition: AutomationDefinition;
}

export type AutomationYamlDraftStreamEvent =
  | {
      type: 'draft.started';
      message: string;
      data: { maxAttempts: number };
    }
  | {
      type: 'draft.model.started';
      message: string;
      data: { providerId: string; modelId: string };
    }
  | {
      type: 'draft.phase';
      message: string;
      data: { attempt: number; phase: string };
    }
  | {
      type: 'draft.message.delta';
      message: string;
      data: { attempt: number };
    }
  | {
      type: 'draft.validation.failed';
      message: string;
      data: { attempt: number };
    }
  | {
      type: 'draft.repair.started';
      message: string;
      data: { attempt: number; nextAttempt: number };
    }
  | {
      type: 'draft.clarification.requested';
      message: string;
      data: { question: string };
    }
  | {
      type: 'draft.completed';
      message: string;
      data: AutomationYamlDraftPayload;
    }
  | {
      type: 'draft.failed';
      message: string;
      data: { status: number };
    };

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
    const deadline = Date.now() + DRAFT_TIMEOUT_MS;
    const messages = this.buildMessages(
      dto.prompt,
      commands,
      model.settings.systemPrompt,
      dto.clarifications,
    );
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
      const stream = this.chatWithStreamEvents({
        provider,
        model,
        messages,
        deadline,
        abortSignal,
        attempt,
      });
      let next = await stream.next();
      while (!next.done) {
        yield next.value;
        next = await stream.next();
      }
      const response = next.value;
      const message = response.choices?.[0]?.message;
      if (!message) {
        lastError = 'AI provider returned no message.';
        yield {
          type: 'draft.validation.failed',
          message: lastError,
          data: { attempt },
        };
        messages.push(this.repairMessage(lastError));
        continue;
      }

      const clarification = this.extractClarificationQuestion(message);
      if (clarification) {
        yield {
          type: 'draft.clarification.requested',
          message: clarification,
          data: { question: clarification },
        };
        return;
      }

      const candidate = this.extractSubmittedYaml(message);
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
        this.assertUsesAllowed(definition, commands);
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
        this.addRepairFeedback(messages, message, lastError);
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
        provider,
        model,
        messages,
        tools: [submitYamlTool(), requestClarificationTool()],
        deadline,
        abortSignal,
        onContentDelta: async (delta) => {
          pending.push({
            type: 'draft.message.delta',
            message: delta,
            data: { attempt },
          });
          notify();
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

    while (!finished || pending.length > 0) {
      while (pending.length > 0) {
        const event = pending.shift();
        if (event) yield event;
      }
      if (!finished) await wait();
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

  private buildMessages(
    prompt: string,
    commands: AutomationCommandDto[],
    modelSystemPrompt?: string | null,
    clarifications?: DraftAutomationYamlDto['clarifications'],
  ): ChatMessage[] {
    return [
      {
        role: 'system',
        content: [
          'You generate Rebroid Android automation YAML drafts.',
          'Return one complete automation definition by calling submitAutomationYaml.',
          `If one missing detail blocks a runnable draft, ask exactly one concise question by calling ${REQUEST_CLARIFICATION_TOOL_NAME}. Do not ask broad preference questions.`,
          'Use apiVersion rebroid.io/automation/v1 and kind AndroidAutomation.',
          'Use concrete available command steps and control steps; do not use ai.run.',
          'Prefer typed commands over android.adbShell. Prefer normalized coordinates when coordinates are necessary.',
          'If a package name is unknown, do not guess it; draft discovery or checks using available package/text/vision commands instead.',
          'Every action step must use one of the available command uses and satisfy its input schema.',
          'Control steps are available as type: condition, type: switch, and type: repeat.',
          'Condition expressions use groups[].conditions[] with value refs: {source: literal, value}, {source: runContext, key}, or {source: stepOutput, stepId, outputKey}.',
          'Use previous step outputs only when the referenced output key is listed for that command.',
          'Good draft shape: metadata has a short name and description; spec.steps use stable ids; waits/checks have explicit timeouts when supported.',
          'Bad draft shape: guessed package names, ai.run steps, unsupported command uses, raw pixel coordinates, or references to outputs not listed in the command catalog.',
          modelSystemPrompt,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        role: 'user',
        content: [
          `Draft request:\n${prompt.trim()}`,
          '',
          this.clarificationsForPrompt(clarifications),
          '',
          'Available commands as JSON:',
          JSON.stringify(this.commandCatalogForPrompt(commands)),
          '',
          'Available runContext keys: targetApplicationId, targetProfileMode, targetProfileName, ownerUserId.',
          'Submit only YAML through the submitAutomationYaml tool.',
        ].join('\n'),
      },
    ];
  }

  private clarificationsForPrompt(
    clarifications?: DraftAutomationYamlDto['clarifications'],
  ) {
    const items = (clarifications ?? [])
      .map(
        (item) =>
          `Q: ${sanitizeAiText(item.question, 500)}\nA: ${sanitizeAiText(item.answer, 1000)}`,
      )
      .filter(Boolean);
    if (items.length === 0) return 'Clarifications: none.';
    return ['Clarifications already answered:', ...items].join('\n');
  }

  private commandCatalogForPrompt(commands: AutomationCommandDto[]) {
    return commands.map((command) => ({
      uses: command.uses,
      label: command.label,
      description: command.description,
      inputSchema: command.inputSchema,
      inputDefaults: command.editor.inputDefaults,
      outputs: command.outputs.map((output) => ({
        key: output.key,
        type: output.type,
        description: output.description,
      })),
    }));
  }

  private extractSubmittedYaml(message: ChatMessage) {
    const toolCall = message.tool_calls?.find(
      (call) => call.function.name === SUBMIT_YAML_TOOL_NAME,
    );
    if (toolCall) {
      const args = parseArguments(toolCall.function.arguments);
      return typeof args.yaml === 'string' && args.yaml.trim()
        ? args.yaml.trim()
        : null;
    }

    const content = textContent(message.content).trim();
    if (!content) return null;
    const fenced = content.match(/```(?:ya?ml)?\s*([\s\S]*?)```/i);
    return (fenced?.[1] ?? content).trim();
  }

  private extractClarificationQuestion(message: ChatMessage) {
    const toolCall = message.tool_calls?.find(
      (call) => call.function.name === REQUEST_CLARIFICATION_TOOL_NAME,
    );
    if (!toolCall) return null;
    const args = parseArguments(toolCall.function.arguments);
    return typeof args.question === 'string' && args.question.trim()
      ? sanitizeAiText(args.question, 500)
      : null;
  }

  private addRepairFeedback(
    messages: ChatMessage[],
    message: ChatMessage,
    lastError: string,
  ) {
    if (message.tool_calls?.length) {
      for (const call of message.tool_calls) {
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content:
            call.function.name === SUBMIT_YAML_TOOL_NAME
              ? `Invalid automation YAML: ${lastError}`
              : `Unsupported draft tool call "${call.function.name}". Submit corrected YAML with ${SUBMIT_YAML_TOOL_NAME}.`,
        });
      }
      return;
    }
    messages.push(this.repairMessage(lastError));
  }

  private repairMessage(lastError: string): ChatMessage {
    return {
      role: 'user',
      content: `The submitted automation YAML was invalid: ${lastError}\nSubmit a corrected complete YAML automation using ${SUBMIT_YAML_TOOL_NAME}.`,
    };
  }

  private assertUsesAllowed(
    definition: AutomationDefinition,
    commands: AutomationCommandDto[],
  ) {
    const allowed = new Set(commands.map((command) => command.uses));
    const assertStep = (step: AutomationDefinitionStep) => {
      if ('uses' in step) {
        if (step.uses === 'ai.run') {
          throw new BadRequestException(
            'Drafted automations must use concrete steps instead of ai.run.',
          );
        }
        if (!allowed.has(step.uses)) {
          throw new BadRequestException(
            `Draft uses unavailable automation command "${step.uses}".`,
          );
        }
        return;
      }
      if (step.type === 'condition') {
        step.then.forEach(assertStep);
        step.else?.forEach(assertStep);
        return;
      }
      if (step.type === 'switch') {
        step.cases.forEach((item) => item.steps.forEach(assertStep));
        step.default?.forEach(assertStep);
        return;
      }
      step.steps.forEach(assertStep);
    };
    definition.spec.steps.forEach(assertStep);
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return sanitizeAiText(error.message);
    }
    return 'AI draft generation failed.';
  }
}

const submitYamlTool = () => ({
  type: 'function' as const,
  function: {
    name: SUBMIT_YAML_TOOL_NAME,
    description: 'Submit the final Rebroid automation YAML draft.',
    parameters: {
      type: 'object' as const,
      properties: {
        yaml: {
          type: 'string',
          description:
            'Complete rebroid.io/automation/v1 AndroidAutomation YAML.',
        },
        notes: {
          type: 'string',
          description: 'Brief implementation notes for the draft.',
        },
      },
      required: ['yaml'],
      additionalProperties: false,
    },
  },
});

const requestClarificationTool = () => ({
  type: 'function' as const,
  function: {
    name: REQUEST_CLARIFICATION_TOOL_NAME,
    description:
      'Ask one concise user-facing question when a missing detail blocks a runnable automation draft.',
    parameters: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description:
            'One concise question that the user can answer to continue drafting.',
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
  },
});
