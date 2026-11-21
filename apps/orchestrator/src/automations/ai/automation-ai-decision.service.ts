import {
  deviceControllerResponseMode,
  modelSupportsStructuredOutput,
  modelSupportsTools,
  providerProtocol,
} from '../../common/ai-provider-request';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  buildDeviceControllerMessages,
  buildDevicePlannerMessages,
} from './core/device-messages';
import {
  buildDeviceDecisionTool,
  deviceDecisionJsonSchema,
  nativeDeviceDecisionJsonSchema,
} from './core/device-decision-schema';
import { parseDeviceAgentDecision } from './core/device-decision';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from '../../settings/contracts/ai-provider';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { permittedActionPrompt } from './automation-ai-action-policy';
import {
  capabilityPrompt,
  commandAllowedForRun,
  type RoutedAiCapabilities,
} from './automation-ai-capability-policy';
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
import type { DeviceAgentRunState } from './automation-device-agent-run-state';

const MAX_DECISION_ATTEMPTS = 2;

export type AutomationAiDecisionContext = {
  input: AutomationAiRunInput;
  context: AutomationAiHarnessContext;
  provider: AutomationAiProvider;
  model: AutomationAiProviderModel;
  deadline: number;
  state: DeviceAgentRunState;
};

type ControllerTurn = AutomationAiDecisionContext & {
  capabilities: RoutedAiCapabilities;
  terminalOnly: boolean;
};

@Injectable()
export class AutomationAiDecisionService {
  constructor(
    private readonly chatClient: AutomationAiChatClientService,
    private readonly events: AutomationRunEventBus,
  ) {}

  async requestDecision(args: ControllerTurn) {
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
    args: ControllerTurn,
    attempt: number,
    validationError: string,
  ) {
    const nativeOllama =
      providerProtocol(args.provider) === 'ollama-native-chat';
    const messages = this.controllerMessages(
      args,
      validationError,
      nativeOllama,
    );
    const mode = deviceControllerResponseMode(args.model);
    if (!mode) {
      throw new BadRequestException(
        'The controller model requires structured output or tool calling.',
      );
    }
    const structuredOutput = mode === 'schema';
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
      tools: structuredOutput ? [] : [buildDeviceDecisionTool(nativeOllama)],
      ...(structuredOutput
        ? {
            responseFormat: {
              type: 'json_schema' as const,
              name: 'device_decision',
              schema: nativeOllama
                ? nativeDeviceDecisionJsonSchema
                : deviceDecisionJsonSchema,
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

  async updatePlan(args: AutomationAiDecisionContext & { reason?: string }) {
    const attempt = args.state.beginPlan();
    const messages = buildDevicePlannerMessages({
      goal: conversationGoal(args.input),
      snapshot: boundedAiText(args.state.plannerText, 18_000),
      failures: [args.reason, args.state.recoveryFeedback()]
        .filter(Boolean)
        .join('\n'),
      customSystemPrompt: boundedAiText(
        args.model.settings.systemPrompt ?? '',
        2_000,
      ),
    });
    const structuredOutput = modelSupportsStructuredOutput(args.model);
    const toolsSupported = modelSupportsTools(args.model);
    const response = await this.chatClient.chat({
      role: 'planner',
      provider: args.provider,
      model: args.model,
      messages,
      tools: structuredOutput || !toolsSupported ? [] : [devicePlanTool],
      ...(structuredOutput
        ? {
            responseFormat: {
              type: 'json_schema' as const,
              name: 'device_plan',
              schema: devicePlanSchema,
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
    args.state.setSubgoals(
      subgoals.length > 0 ? subgoals : fallbackDevicePlan(args.input.prompt),
    );
    await emitAutomationAiEvent(
      this.events,
      args.context,
      attempt === 1 ? 'ai.plan.proposed' : 'ai.plan.updated',
      devicePlanText(args.state.subgoals),
      {
        reason: args.reason ?? 'initial complexity policy',
        subgoalCount: args.state.subgoals.length,
        clientMessageId: args.input.clientMessageId ?? null,
      },
    );
  }

  private controllerMessages(
    { input, model, state, capabilities, terminalOnly }: ControllerTurn,
    validationError: string,
    nativeOllama: boolean,
  ) {
    const messages = buildDeviceControllerMessages({
      goal: conversationGoal(input),
      decisionEnvelope: !nativeOllama,
      snapshot: [
        boundedAiText(state.plannerText, 18_000),
        `targetSession=${state.target.id}; current screen evidence=snapshot:${state.observation.snapshotId}`,
      ].join('\n'),
      actions: [
        permittedActionPrompt((uses) => commandAllowedForRun(input, uses)),
        boundedAiText(capabilityPrompt(capabilities), 8_000),
      ].join('\n'),
      plan: devicePlanText(state.subgoals),
      feedback: [
        terminalOnly
          ? '- No more actions are available. Return finish or ask_user.'
          : `- Remaining action attempts: ${input.maxActions - state.actions}.`,
        validationError
          ? `- Previous decision rejected: ${boundedAiText(validationError, 700)} Return a corrected decision.`
          : '',
        state.recoveryFeedback(),
      ]
        .filter(Boolean)
        .join('\n'),
      trajectory: boundedAiText(
        [
          ...state.controllerEvidence(),
          ...state.trajectory
            .slice(-8)
            .filter((entry) => !entry.failed)
            .map(
              (entry) =>
                `- ${entry.action}: ${entry.outcome} [evidence=${entry.evidenceId}${entry.snapshotId ? `, snapshot=${entry.snapshotId}` : ''}]`,
            ),
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
