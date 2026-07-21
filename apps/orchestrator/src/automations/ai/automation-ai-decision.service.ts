import { BadRequestException, Injectable } from '@nestjs/common';
import {
  buildDeviceControllerMessages,
  buildDevicePlannerMessages,
} from './core/device-messages';
import {
  buildDeviceDecisionTool,
  deviceDecisionJsonSchema,
  parseDeviceAgentDecision,
} from './core/device-decision';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from '../../settings/contracts/ai-provider';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { emitAutomationAiEvent } from './automation-ai-events';
import { textContent } from './automation-ai-message.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import {
  boundedAiText,
  conversationGoal,
  devicePlanSchema,
  devicePlanText,
  devicePlanTool,
  fallbackDevicePlan,
  parseDevicePlan,
} from './automation-ai-plan';
import {
  capabilityPrompt,
  routeCapabilities,
  type DeviceAgentState,
} from './automation-device-agent-state';

const MAX_DECISION_ATTEMPTS = 2;

type DecisionContext = {
  input: AutomationAiRunInput;
  context: AutomationAiHarnessContext;
  provider: AutomationAiProvider;
  model: AutomationAiProviderModel;
  deadline: number;
  state: DeviceAgentState;
};

@Injectable()
export class AutomationAiDecisionService {
  constructor(
    private readonly chatClient: AutomationAiChatClientService,
    private readonly events: AutomationRunEventBus,
  ) {}

  async requestDecision(
    args: DecisionContext & {
      capabilities: ReturnType<typeof routeCapabilities>;
    },
  ) {
    let validationError = '';
    for (let attempt = 0; attempt < MAX_DECISION_ATTEMPTS; attempt += 1) {
      const response = await this.requestControllerTurn(
        args,
        attempt,
        validationError,
      );
      const message = response.choices?.[0]?.message;
      if (!message) {
        validationError = 'Provider returned no controller message.';
        continue;
      }
      try {
        return parseDeviceAgentDecision({
          content: textContent(message.content),
          defaultSnapshotId: args.state.observation.snapshotId,
          toolCalls: message.tool_calls,
        });
      } catch (error) {
        validationError =
          error instanceof Error ? error.message : String(error);
        await emitAutomationAiEvent(
          this.events,
          args.context,
          'ai.guardrail.triggered',
          validationError,
          {
            attempt: attempt + 1,
            reasoningPresent: response.generation?.reasoningPresent ?? false,
            clientMessageId: args.input.clientMessageId ?? null,
          },
        );
      }
    }
    throw new BadRequestException(
      validationError || 'Provider could not produce a valid device decision.',
    );
  }

  private async requestControllerTurn(
    args: DecisionContext & {
      capabilities: ReturnType<typeof routeCapabilities>;
    },
    attempt: number,
    validationError: string,
  ) {
    const messages = this.controllerMessages({
      input: args.input,
      model: args.model,
      state: args.state,
      capabilities: args.capabilities,
      validationError,
    });
    const structuredOutput = args.model.capabilities?.structuredOutput === true;
    const effectiveModel =
      attempt > 0 && args.model.settings.thinkingMode !== 'disabled'
        ? {
            ...args.model,
            settings: {
              ...args.model.settings,
              thinkingMode: 'disabled' as const,
            },
          }
        : args.model;
    const response = await this.chatClient.chat({
      provider: args.provider,
      model: effectiveModel,
      messages,
      tools: structuredOutput ? [] : [buildDeviceDecisionTool()],
      ...(structuredOutput
        ? {
            responseFormat: {
              type: 'json_schema' as const,
              json_schema: {
                name: 'device_decision',
                strict: true,
                schema: deviceDecisionJsonSchema,
              },
              schema: deviceDecisionJsonSchema,
            },
          }
        : {}),
      deadline: args.deadline,
      abortSignal: args.context.abortSignal,
    });
    await emitAutomationAiEvent(
      this.events,
      args.context,
      'ai.model.completed',
      'Controller turn completed.',
      {
        providerId: args.provider.id,
        modelId: args.model.id,
        attempt: attempt + 1,
        ...(response.generation ?? {}),
      },
    );
    return response;
  }

  async updatePlan(args: DecisionContext & { reason?: string }) {
    args.state.planAttempts += 1;
    const messages = buildDevicePlannerMessages({
      goal: conversationGoal(args.input),
      snapshot: boundedAiText(args.state.plannerText, 18_000),
      failures: args.reason,
      customSystemPrompt: boundedAiText(
        args.model.settings.systemPrompt ?? '',
        2_000,
      ),
    });
    const structuredOutput = args.model.capabilities?.structuredOutput === true;
    const toolsSupported = args.model.capabilities?.tools !== false;
    const response = await this.chatClient.chat({
      provider: args.provider,
      model: args.model,
      messages,
      tools: structuredOutput || !toolsSupported ? [] : [devicePlanTool],
      ...(structuredOutput
        ? {
            responseFormat: {
              type: 'json_schema' as const,
              schema: devicePlanSchema,
              json_schema: {
                name: 'device_plan',
                strict: true,
                schema: devicePlanSchema,
              },
            },
          }
        : {}),
      deadline: args.deadline,
      abortSignal: args.context.abortSignal,
    });
    const message = response.choices?.[0]?.message;
    const planCall = message?.tool_calls?.find(
      (call) => call.function.name === 'submit_device_plan',
    );
    const content =
      planCall?.function.arguments ?? textContent(message?.content);
    const subgoals = parseDevicePlan(content);
    args.state.subgoals =
      subgoals.length > 0 ? subgoals : fallbackDevicePlan(args.input.prompt);
    await emitAutomationAiEvent(
      this.events,
      args.context,
      args.state.planAttempts === 1 ? 'ai.plan.proposed' : 'ai.plan.updated',
      devicePlanText(args.state.subgoals),
      {
        reason: args.reason ?? 'initial complexity policy',
        subgoalCount: args.state.subgoals.length,
        clientMessageId: args.input.clientMessageId ?? null,
      },
    );
  }

  private controllerMessages({
    input,
    model,
    state,
    capabilities,
    validationError,
  }: {
    input: AutomationAiRunInput;
    model: AutomationAiProviderModel;
    state: DeviceAgentState;
    capabilities: ReturnType<typeof routeCapabilities>;
    validationError: string;
  }) {
    const messages = buildDeviceControllerMessages({
      goal: conversationGoal(input),
      snapshot: boundedAiText(
        `${state.plannerText}\n${capabilityPrompt(capabilities)}\ntargetSession=${state.target.id}`,
        20_000,
      ),
      plan: devicePlanText(state.subgoals),
      trajectory: boundedAiText(
        [
          ...state.trajectory
            .slice(-8)
            .map(
              (entry) =>
                `- ${entry.action}: ${entry.outcome} [evidence=${entry.evidenceId}${entry.snapshotId ? `, snapshot=${entry.snapshotId}` : ''}]`,
            ),
          validationError
            ? `- Previous decision rejected: ${validationError}. Return a corrected decision.`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        8_000,
      ),
      customSystemPrompt: boundedAiText(
        model.settings.systemPrompt ?? '',
        2_000,
      ),
    });
    if (
      (model.roles.includes('vision') || model.capabilities?.vision === true) &&
      state.observation.markedImage
    ) {
      const last = messages.at(-1);
      if (last && typeof last.content === 'string') {
        last.content = [
          { type: 'text', text: last.content },
          {
            type: 'image_url',
            image_url: { url: state.observation.markedImage.dataUrl },
          },
        ];
      }
    }
    return messages;
  }
}
