import { BadRequestException, Injectable } from '@nestjs/common';
import {
  buildDeviceControllerMessages,
  buildDeviceDecisionTool,
  buildDevicePlannerMessages,
  deviceDecisionJsonSchema,
  parseDeviceAgentDecision,
  type DeviceAgentDecision,
} from '@rebroid/ai-core/harness';
import { SCREEN_MUTATING_TOOLS } from '@rebroid/ai-core/observation';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from '@rebroid/ai-core/provider';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import {
  assertTargetSession,
  capabilityPrompt,
  createTargetSession,
  resolveActionTool,
  resultIndicatesFailure,
  routeCapabilities,
  screenFingerprint,
  shouldPlanInitially,
  toolAllowedForRun,
  validatedEscalationCommand,
  type DeviceAgentEvidence,
  type DeviceAgentState,
  type DeviceAgentSubgoal,
} from './automation-device-agent-state';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { textContent } from './automation-ai-message.utils';

const MAX_DECISION_ATTEMPTS = 2;
const MAX_PLAN_ATTEMPTS = 2;

@Injectable()
export class AutomationAiHarnessService {
  constructor(
    private readonly aiProviders: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly events: AutomationRunEventBus,
    private readonly perception: AutomationPerceptionService,
    private readonly chatClient: AutomationAiChatClientService,
  ) {}

  async run(input: AutomationAiRunInput, context: AutomationAiHarnessContext) {
    const deadline = Date.now() + input.timeoutMs;
    const maxActions = input.maxActions ?? input.maxToolCalls;
    const { provider, model } = await this.aiProviders.getProvider(
      input.providerId,
      input.modelId,
      'controller',
    );
    const capabilities = routeCapabilities({
      commands: this.registry.listCommands(),
      goal: input.prompt,
      input,
    });
    await this.emit(context, 'ai.model.started', 'Device agent started.', {
      providerId: provider.id,
      modelId: model.id,
      protocol: provider.protocol ?? 'openai-chat-completions',
      capabilityCount: capabilities.length,
      actionLimit: maxActions,
      clientMessageId: input.clientMessageId ?? null,
    });

    const observed = await this.observe({
      input,
      context,
      deadline,
      reason: 'initial',
    });
    const target = createTargetSession(context);
    const initialEvidence: DeviceAgentEvidence = {
      id: `snapshot:${observed.observation.snapshotId}`,
      kind: 'snapshot',
      summary:
        observed.observation.summary ?? 'Initial device snapshot captured.',
      snapshotId: observed.observation.snapshotId,
    };
    const state: DeviceAgentState = {
      target,
      observation: observed.observation,
      plannerText: observed.plannerText,
      subgoals: [],
      evidence: [initialEvidence],
      trajectory: [],
      actions: 0,
      consecutiveFailures: 0,
      planAttempts: 0,
    };

    if (shouldPlanInitially(input.agentMode ?? 'adaptive', input.prompt)) {
      await this.updatePlan({
        input,
        context,
        provider,
        model,
        deadline,
        state,
      });
    }

    while (Date.now() < deadline && state.actions < maxActions) {
      this.assertNotCanceled(context.abortSignal);
      const decision = await this.requestDecision({
        input,
        context,
        provider,
        model,
        deadline,
        state,
        capabilities,
      });
      await this.emit(context, 'ai.action.decided', decisionSummary(decision), {
        kind: decision.kind,
        snapshotId:
          decision.kind === 'act'
            ? decision.snapshotId
            : state.observation.snapshotId,
        targetFingerprint: state.target.fingerprint,
        clientMessageId: input.clientMessageId ?? null,
      });

      if (decision.kind === 'needs_plan') {
        if (state.planAttempts >= MAX_PLAN_ATTEMPTS) {
          state.trajectory.push({
            action: 'needs_plan',
            outcome:
              'Planner budget exhausted; choose a concrete action or finish blocked.',
            evidenceId: initialEvidence.id,
            failed: true,
          });
          continue;
        }
        await this.updatePlan({
          input,
          context,
          provider,
          model,
          deadline,
          state,
          reason: decision.reason,
        });
        continue;
      }

      if (decision.kind === 'ask_user') {
        return await this.finish(context, input, state, {
          status: 'blocked',
          finalText: decision.question,
          blockedReason: decision.reason,
        });
      }

      if (decision.kind === 'finish') {
        const verified = this.verifyFinish(decision, state);
        if (!verified.ok) {
          await this.emit(context, 'ai.guardrail.triggered', verified.reason, {
            clientMessageId: input.clientMessageId ?? null,
          });
          state.trajectory.push({
            action: 'finish',
            outcome: verified.reason,
            evidenceId: initialEvidence.id,
            failed: true,
          });
          state.consecutiveFailures += 1;
          continue;
        }
        return await this.finish(context, input, state, {
          status: decision.status,
          finalText: decision.finalText,
          blockedReason:
            decision.status === 'blocked'
              ? (decision.reason ?? decision.finalText)
              : null,
        });
      }

      if (decision.kind === 'request_escalation') {
        const escalationResult = await this.executeEscalation({
          decision,
          input,
          context,
          state,
        });
        if (!escalationResult) continue;
        state.actions += 1;
        continue;
      }

      await this.executeAction({
        decision,
        input,
        context,
        deadline,
        state,
        capabilities,
      });
      state.actions += 1;
      if (
        state.consecutiveFailures >= 2 &&
        state.planAttempts < MAX_PLAN_ATTEMPTS &&
        input.agentMode !== 'controller'
      ) {
        await this.updatePlan({
          input,
          context,
          provider,
          model,
          deadline,
          state,
          reason: 'Two consecutive actions failed verification.',
        });
      }
    }

    return await this.finish(context, input, state, {
      status: 'blocked',
      finalText:
        Date.now() >= deadline
          ? 'The device agent timed out before the requested result was verified.'
          : 'The device agent reached its action limit before the requested result was verified.',
      blockedReason:
        Date.now() >= deadline
          ? 'Agent timeout reached.'
          : 'Action limit reached.',
    });
  }

  private async requestDecision({
    input,
    context,
    provider,
    model,
    deadline,
    state,
    capabilities,
  }: {
    input: AutomationAiRunInput;
    context: AutomationAiHarnessContext;
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
    deadline: number;
    state: DeviceAgentState;
    capabilities: ReturnType<typeof routeCapabilities>;
  }) {
    let validationError = '';
    for (let attempt = 0; attempt < MAX_DECISION_ATTEMPTS; attempt += 1) {
      const messages = this.controllerMessages({
        input,
        model,
        state,
        capabilities,
        validationError,
      });
      const structuredOutput = model.capabilities?.structuredOutput === true;
      const effectiveModel =
        attempt > 0 && model.settings.thinkingMode !== 'disabled'
          ? {
              ...model,
              settings: {
                ...model.settings,
                thinkingMode: 'disabled' as const,
              },
            }
          : model;
      const response = await this.chatClient.chat({
        provider,
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
        deadline,
        abortSignal: context.abortSignal,
      });
      await this.emit(
        context,
        'ai.model.completed',
        'Controller turn completed.',
        {
          providerId: provider.id,
          modelId: model.id,
          attempt: attempt + 1,
          ...(response.generation ?? {}),
        },
      );
      const message = response.choices?.[0]?.message;
      if (!message) {
        validationError = 'Provider returned no controller message.';
        continue;
      }
      try {
        return parseDeviceAgentDecision({
          content: textContent(message.content),
          defaultSnapshotId: state.observation.snapshotId,
          toolCalls: message.tool_calls,
        });
      } catch (error) {
        validationError =
          error instanceof Error ? error.message : String(error);
        await this.emit(context, 'ai.guardrail.triggered', validationError, {
          attempt: attempt + 1,
          reasoningPresent: response.generation?.reasoningPresent ?? false,
          clientMessageId: input.clientMessageId ?? null,
        });
      }
    }
    throw new BadRequestException(
      validationError || 'Provider could not produce a valid device decision.',
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
      snapshot: boundedText(
        `${state.plannerText}\n${capabilityPrompt(capabilities)}\ntargetSession=${state.target.id}`,
        20_000,
      ),
      plan: planText(state.subgoals),
      trajectory: boundedText(
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
      customSystemPrompt: boundedText(model.settings.systemPrompt ?? '', 2_000),
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

  private async updatePlan({
    input,
    context,
    provider,
    model,
    deadline,
    state,
    reason,
  }: {
    input: AutomationAiRunInput;
    context: AutomationAiHarnessContext;
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
    deadline: number;
    state: DeviceAgentState;
    reason?: string;
  }) {
    state.planAttempts += 1;
    const messages = buildDevicePlannerMessages({
      goal: conversationGoal(input),
      snapshot: boundedText(state.plannerText, 18_000),
      failures: reason,
      customSystemPrompt: boundedText(model.settings.systemPrompt ?? '', 2_000),
    });
    const structuredOutput = model.capabilities?.structuredOutput === true;
    const toolsSupported = model.capabilities?.tools !== false;
    const response = await this.chatClient.chat({
      provider,
      model,
      messages,
      tools: structuredOutput || !toolsSupported ? [] : [devicePlanTool],
      ...(structuredOutput
        ? {
            responseFormat: {
              type: 'json_schema' as const,
              schema: planSchema,
              json_schema: {
                name: 'device_plan',
                strict: true,
                schema: planSchema,
              },
            },
          }
        : {}),
      deadline,
      abortSignal: context.abortSignal,
    });
    const message = response.choices?.[0]?.message;
    const planCall = message?.tool_calls?.find(
      (call) => call.function.name === 'submit_device_plan',
    );
    const content =
      planCall?.function.arguments ?? textContent(message?.content);
    const subgoals = parsePlan(content);
    state.subgoals =
      subgoals.length > 0 ? subgoals : fallbackPlan(input.prompt);
    await this.emit(
      context,
      state.planAttempts === 1 ? 'ai.plan.proposed' : 'ai.plan.updated',
      planText(state.subgoals),
      {
        reason: reason ?? 'initial complexity policy',
        subgoalCount: state.subgoals.length,
        clientMessageId: input.clientMessageId ?? null,
      },
    );
  }

  private async executeAction({
    decision,
    input,
    context,
    deadline,
    state,
    capabilities,
  }: {
    decision: Extract<DeviceAgentDecision, { kind: 'act' }>;
    input: AutomationAiRunInput;
    context: AutomationAiHarnessContext;
    deadline: number;
    state: DeviceAgentState;
    capabilities: ReturnType<typeof routeCapabilities>;
  }) {
    if (decision.snapshotId !== state.observation.snapshotId) {
      await this.recordRejectedAction(
        context,
        state,
        decision,
        `Stale snapshot ${decision.snapshotId}; latest is ${state.observation.snapshotId}.`,
      );
      return;
    }
    assertTargetSession(state.target, context);
    const resolved = resolveActionTool({
      action: decision.action,
      observation: state.observation,
    });
    if (!toolAllowedForRun(input, resolved.uses)) {
      await this.recordRejectedAction(
        context,
        state,
        decision,
        `Tool ${resolved.uses} is outside this run's capability policy.`,
      );
      return;
    }
    if (
      decision.action.type === 'invoke_capability' &&
      !capabilities.some((capability) => capability.uses === resolved.uses)
    ) {
      await this.recordRejectedAction(
        context,
        state,
        decision,
        `Capability ${resolved.uses} was not routed into this run.`,
      );
      return;
    }
    const beforeFingerprint = screenFingerprint(state.observation);
    await this.emit(context, 'ai.tool.started', decision.intent, {
      uses: resolved.uses,
      targetFingerprint: state.target.fingerprint,
      snapshotId: state.observation.snapshotId,
    });
    await this.emit(context, 'ai.tool.arguments', decision.expectedOutcome, {
      uses: resolved.uses,
      input: resolved.input,
    });
    try {
      const result = await context.toolExecutor({
        name: resolved.uses,
        arguments: resolved.input,
        intent: decision.intent,
        expectedOutcome: decision.expectedOutcome,
        envelopeValid: true,
        toolCallId: `action-${state.actions + 1}`,
      });
      const structuredFailure = resultIndicatesFailure(result.data ?? {});
      const shouldObserve =
        resolved.screenMutating || SCREEN_MUTATING_TOOLS.has(resolved.uses);
      if (shouldObserve) {
        const observed = await this.observe({
          input,
          context,
          deadline,
          reason: `after:${resolved.uses}`,
          uses: resolved.uses,
        });
        state.observation = observed.observation;
        state.plannerText = observed.plannerText;
      }
      const unchanged =
        shouldObserve &&
        decision.action.type !== 'wait' &&
        beforeFingerprint === screenFingerprint(state.observation);
      const failed = structuredFailure || unchanged;
      const evidence: DeviceAgentEvidence = {
        id: `action:${state.actions + 1}`,
        kind: shouldObserve ? 'action' : 'typed-result',
        summary: failed
          ? unchanged
            ? `${result.summary} Screen did not change.`
            : result.summary
          : result.summary,
        ...(shouldObserve ? { snapshotId: state.observation.snapshotId } : {}),
        ...(result.data ? { data: result.data } : {}),
      };
      state.evidence.push(evidence);
      state.trajectory.push({
        action: `${resolved.uses} (${decision.intent})`,
        outcome: evidence.summary,
        evidenceId: evidence.id,
        snapshotId: evidence.snapshotId,
        failed,
      });
      state.consecutiveFailures = failed ? state.consecutiveFailures + 1 : 0;
      await this.emit(
        context,
        failed ? 'ai.tool.failed' : 'ai.tool.completed',
        evidence.summary,
        {
          uses: resolved.uses,
          evidenceId: evidence.id,
          failed,
          unchanged,
          targetFingerprint: state.target.fingerprint,
          snapshotId: state.observation.snapshotId,
          data: result.data ?? {},
        },
      );
    } catch (error) {
      const message = sanitizeAiText(
        error instanceof Error ? error.message : String(error),
        1_000,
      );
      const evidenceId = `action:${state.actions + 1}`;
      state.evidence.push({
        id: evidenceId,
        kind: 'typed-result',
        summary: message,
      });
      state.trajectory.push({
        action: resolved.uses,
        outcome: message,
        evidenceId,
        failed: true,
      });
      state.consecutiveFailures += 1;
      await this.emit(context, 'ai.tool.failed', message, {
        uses: resolved.uses,
        evidenceId,
        targetFingerprint: state.target.fingerprint,
      });
    }
  }

  private async executeEscalation({
    decision,
    input,
    context,
    state,
  }: {
    decision: Extract<DeviceAgentDecision, { kind: 'request_escalation' }>;
    input: AutomationAiRunInput;
    context: AutomationAiHarnessContext;
    state: DeviceAgentState;
  }) {
    const command = validatedEscalationCommand(decision.program, decision.args);
    if (input.rawShellPolicy !== 'allowlisted' || !command) {
      const reason =
        input.rawShellPolicy !== 'allowlisted'
          ? 'Raw ADB shell is disabled for this run.'
          : 'Requested ADB command is outside the read-only escalation allowlist.';
      await this.emit(context, 'ai.guardrail.triggered', reason, {
        program: decision.program,
        targetFingerprint: state.target.fingerprint,
      });
      state.trajectory.push({
        action: 'request_escalation',
        outcome: reason,
        evidenceId: state.evidence[0].id,
        failed: true,
      });
      state.consecutiveFailures += 1;
      return false;
    }
    assertTargetSession(state.target, context);
    const result = await context.toolExecutor({
      name: 'android.adbShell',
      arguments: { command, timeoutMs: 10_000 },
      intent: decision.reason,
      expectedOutcome: 'Read-only Android state is returned.',
      envelopeValid: true,
      toolCallId: `escalation-${state.actions + 1}`,
    });
    const failed = resultIndicatesFailure(result.data ?? {});
    const evidenceId = `action:${state.actions + 1}`;
    state.evidence.push({
      id: evidenceId,
      kind: 'typed-result',
      summary: result.summary,
      data: result.data,
    });
    state.trajectory.push({
      action: `allowlisted:${decision.program}`,
      outcome: result.summary,
      evidenceId,
      failed,
    });
    state.consecutiveFailures = failed ? state.consecutiveFailures + 1 : 0;
    await this.emit(
      context,
      failed ? 'ai.tool.failed' : 'ai.tool.completed',
      result.summary,
      { uses: 'android.adbShell', evidenceId, failed },
    );
    return true;
  }

  private verifyFinish(
    decision: Extract<DeviceAgentDecision, { kind: 'finish' }>,
    state: DeviceAgentState,
  ): { ok: true } | { ok: false; reason: string } {
    const knownEvidence = new Set(
      state.evidence.map((evidence) => evidence.id),
    );
    const unknownEvidence = decision.evidenceIds.filter(
      (evidenceId) => !knownEvidence.has(evidenceId),
    );
    if (unknownEvidence.length > 0) {
      return {
        ok: false,
        reason: `Completion referenced unknown evidence: ${unknownEvidence.join(', ')}.`,
      };
    }
    if (decision.status === 'completed' && decision.evidenceIds.length === 0) {
      return {
        ok: false,
        reason: 'Completed status requires observed evidence.',
      };
    }
    const knownSubgoals = new Set(state.subgoals.map((subgoal) => subgoal.id));
    if (
      decision.completedSubgoalIds.some(
        (subgoalId) => !knownSubgoals.has(subgoalId),
      )
    ) {
      return { ok: false, reason: 'Completion referenced an unknown subgoal.' };
    }
    if (
      decision.status === 'completed' &&
      state.subgoals.some(
        (subgoal) => !decision.completedSubgoalIds.includes(subgoal.id),
      )
    ) {
      return { ok: false, reason: 'Not all planned subgoals were completed.' };
    }
    state.subgoals = state.subgoals.map((subgoal) => ({
      ...subgoal,
      status: decision.completedSubgoalIds.includes(subgoal.id)
        ? 'completed'
        : subgoal.status,
    }));
    return { ok: true };
  }

  private async recordRejectedAction(
    context: AutomationAiHarnessContext,
    state: DeviceAgentState,
    decision: Extract<DeviceAgentDecision, { kind: 'act' }>,
    reason: string,
  ) {
    state.trajectory.push({
      action: decision.action.type,
      outcome: reason,
      evidenceId: state.evidence[0].id,
      failed: true,
    });
    state.consecutiveFailures += 1;
    await this.emit(context, 'ai.guardrail.triggered', reason, {
      latestSnapshotId: state.observation.snapshotId,
      targetFingerprint: state.target.fingerprint,
    });
  }

  private async observe({
    input,
    context,
    deadline,
    reason,
    uses,
  }: {
    input: AutomationAiRunInput;
    context: AutomationAiHarnessContext;
    deadline: number;
    reason: string;
    uses?: string;
  }) {
    return await this.perception.observe({
      context: { ...context, clientMessageId: input.clientMessageId ?? null },
      input,
      deadline,
      reason,
      uses,
      visionContext: { goal: input.prompt },
    });
  }

  private async finish(
    context: AutomationAiHarnessContext,
    input: AutomationAiRunInput,
    state: DeviceAgentState,
    result: {
      status: 'completed' | 'blocked';
      finalText: string;
      blockedReason: string | null;
    },
  ) {
    const finalText = sanitizeAiText(result.finalText, 4_000);
    await this.emit(context, 'ai.message.completed', finalText, {
      status: result.status,
      completed: result.status === 'completed',
      clientMessageId: input.clientMessageId ?? null,
      evidenceIds: state.evidence.map((evidence) => evidence.id),
      targetFingerprint: state.target.fingerprint,
      lastSnapshotId: state.observation.snapshotId,
    });
    return {
      summary: finalText,
      data: {
        finalText,
        status: result.status,
        completed: result.status === 'completed',
        toolCalls: state.actions,
        blockedReason: result.blockedReason,
        evidence: {
          actionCount: state.actions,
          actionLimitReached:
            state.actions >= (input.maxActions ?? input.maxToolCalls),
          lastSnapshotId: state.observation.snapshotId,
          targetFingerprint: state.target.fingerprint,
          verifierFailures: state.trajectory.filter((entry) => entry.failed)
            .length,
          evidenceIds: state.evidence.map((evidence) => evidence.id),
        },
      },
    };
  }

  private emit(
    context: AutomationAiHarnessContext,
    type: Parameters<AutomationRunEventBus['emit']>[0]['type'],
    message: string,
    data: Record<string, unknown> = {},
  ) {
    return this.events.emit({
      runId: context.runId,
      ownerUserId: context.ownerUserId,
      type,
      stepId: context.stepId,
      parentStepId: context.parentStepId ?? null,
      message,
      data,
    });
  }

  private assertNotCanceled(abortSignal?: AbortSignal) {
    if (abortSignal?.aborted) {
      throw new BadRequestException('AI automation was canceled.');
    }
  }
}

const planSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    subgoals: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 120 },
          goal: { type: 'string', minLength: 1, maxLength: 500 },
          successEvidence: { type: 'string', minLength: 1, maxLength: 500 },
        },
        required: ['id', 'goal', 'successEvidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['subgoals'],
  additionalProperties: false,
};

const devicePlanTool = {
  type: 'function' as const,
  function: {
    name: 'submit_device_plan',
    description: 'Submit the short, verifiable device automation subgoal plan.',
    parameters: planSchema,
  },
};

const parsePlan = (content: string): DeviceAgentSubgoal[] => {
  try {
    const parsed = JSON.parse(content) as { subgoals?: unknown };
    if (!Array.isArray(parsed.subgoals)) return [];
    return parsed.subgoals.slice(0, 6).flatMap((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return [];
      const subgoal = value as Record<string, unknown>;
      if (
        typeof subgoal.goal !== 'string' ||
        typeof subgoal.successEvidence !== 'string'
      ) {
        return [];
      }
      return [
        {
          id:
            typeof subgoal.id === 'string' && subgoal.id.trim()
              ? subgoal.id.trim().slice(0, 120)
              : `subgoal-${index + 1}`,
          goal: subgoal.goal.trim().slice(0, 500),
          successEvidence: subgoal.successEvidence.trim().slice(0, 500),
          status: 'pending' as const,
        },
      ];
    });
  } catch {
    return [];
  }
};

const fallbackPlan = (prompt: string): DeviceAgentSubgoal[] => [
  {
    id: 'goal-1',
    goal: prompt.trim().slice(0, 500),
    successEvidence:
      'A fresh device snapshot or typed result confirms the requested outcome.',
    status: 'pending',
  },
];

const planText = (subgoals: DeviceAgentSubgoal[]) =>
  subgoals.length === 0
    ? ''
    : subgoals
        .map(
          (subgoal) =>
            `- [${subgoal.status}] ${subgoal.id}: ${subgoal.goal} (evidence: ${subgoal.successEvidence})`,
        )
        .join('\n');

const conversationGoal = (input: AutomationAiRunInput) => {
  const history = (input.conversation ?? [])
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
  return boundedText(
    history ? `${history}\nuser: ${input.prompt}` : input.prompt,
    8_000,
  );
};

const boundedText = (value: string, maxLength: number) =>
  value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}…[truncated]`;

const decisionSummary = (decision: DeviceAgentDecision) => {
  if (decision.kind === 'act')
    return `${decision.action.type}: ${decision.intent}`;
  if (decision.kind === 'finish') return `finish:${decision.status}`;
  if (decision.kind === 'ask_user') return decision.question;
  return decision.reason;
};
