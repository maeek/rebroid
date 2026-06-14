import { BadRequestException, Injectable } from '@nestjs/common';
import { parseArguments, type ChatMessage } from '@rebroid/ai-core/harness';
import type {
  AutomationDefinition,
  AutomationDefinitionStep,
} from '@rebroid/automation-core/definition';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import {
  AutomationYamlDraftDto,
  DraftAutomationYamlDto,
} from '../dto/automation.dto';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { AutomationAiProviderService } from './automation-ai-provider.service';

const DRAFT_TIMEOUT_MS = 120_000;
const MAX_DRAFT_ATTEMPTS = 3;
const SUBMIT_YAML_TOOL_NAME = 'submitAutomationYaml';

@Injectable()
export class AutomationAiYamlDraftService {
  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly definitions: AutomationDefinitionService,
    private readonly chatClient: AutomationAiChatClientService,
  ) {}

  async draft(dto: DraftAutomationYamlDto): Promise<AutomationYamlDraftDto> {
    const { provider, model } = await this.providers.getProvider(
      dto.providerId,
      dto.modelId,
      'planner',
    );
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
    );
    let lastError = 'AI provider did not submit automation YAML.';

    for (let attempt = 1; attempt <= MAX_DRAFT_ATTEMPTS; attempt += 1) {
      const response = await this.chatClient.chat({
        provider,
        model,
        messages,
        tools: [submitYamlTool()],
        deadline,
      });
      const message = response.choices?.[0]?.message;
      if (!message) {
        lastError = 'AI provider returned no message.';
        messages.push(this.repairMessage(lastError));
        continue;
      }

      const candidate = this.extractSubmittedYaml(message);
      messages.push(message);
      try {
        if (!candidate) {
          throw new BadRequestException(
            'Response did not include submitted automation YAML.',
          );
        }
        const definition = this.definitions.parseYaml(candidate);
        this.assertUsesAllowed(definition, commands);
        return {
          definition,
          yaml: this.definitions.toYaml(definition),
        };
      } catch (error) {
        lastError =
          error instanceof Error ? sanitizeAiText(error.message) : lastError;
        this.addRepairFeedback(messages, message, lastError);
        if (attempt === MAX_DRAFT_ATTEMPTS) break;
      }
    }

    throw new BadRequestException(
      `AI draft did not produce valid automation YAML: ${lastError}`,
    );
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
  ): ChatMessage[] {
    return [
      {
        role: 'system',
        content: [
          'You generate Rebroid Android automation YAML drafts.',
          'Do not execute tools or describe a plan. Return one complete automation definition by calling submitAutomationYaml.',
          'Use apiVersion rebroid.io/automation/v1 and kind AndroidAutomation.',
          'Use concrete available command steps and control steps; do not use ai.run.',
          'Prefer typed commands over android.adbShell. Prefer normalized coordinates when coordinates are necessary.',
          'If a package name is unknown, do not guess it; draft discovery or checks using available package/text/vision commands instead.',
          'Every action step must use one of the available command uses and satisfy its input schema.',
          'Control steps are available as type: condition, type: switch, and type: repeat.',
          'Condition expressions use groups[].conditions[] with value refs: {source: literal, value}, {source: runContext, key}, or {source: stepOutput, stepId, outputKey}.',
          'Use previous step outputs only when the referenced output key is listed for that command.',
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
          'Available commands as JSON:',
          JSON.stringify(this.commandCatalogForPrompt(commands)),
          '',
          'Available runContext keys: targetApplicationId, targetProfileMode, targetProfileName, ownerUserId.',
          'Submit only YAML through the submitAutomationYaml tool.',
        ].join('\n'),
      },
    ];
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

const textContent = (content: ChatMessage['content']) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
      : '';
