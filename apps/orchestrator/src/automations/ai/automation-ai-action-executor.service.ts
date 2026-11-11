import { Injectable } from '@nestjs/common';
import type { DeviceAgentDecision } from './core/device-decision';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
import { emitAutomationAiEvent } from './automation-ai-events';
import { sanitizeAiText } from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import {
  assertTargetSession,
  resolveActionTool,
  resultIndicatesFailure,
  routeCapabilities,
  screenFingerprint,
  toolAllowedForRun,
  validatedEscalationCommand,
} from './automation-device-agent-state';
import type { DeviceAgentRunState } from './automation-device-agent-run-state';

type ActionContext = {
  input: AutomationAiRunInput;
  context: AutomationAiHarnessContext;
  state: DeviceAgentRunState;
};

type ActDecision = Extract<DeviceAgentDecision, { kind: 'act' }>;
type ResolvedAction = ReturnType<typeof resolveActionTool>;
type ToolResult = Awaited<
  ReturnType<AutomationAiHarnessContext['toolExecutor']>
>;
type ObservedScreen = Awaited<
  ReturnType<AutomationAiActionExecutor['observe']>
>;
type ActionDispatch = { result: ToolResult } | { error: unknown };

type ExecuteActionArgs = ActionContext & {
  decision: ActDecision;
  deadline: number;
  capabilities: ReturnType<typeof routeCapabilities>;
};

@Injectable()
export class AutomationAiActionExecutor {
  constructor(
    private readonly events: AutomationRunEventBus,
    private readonly perception: AutomationPerceptionService,
  ) {}

  async executeAction(args: ExecuteActionArgs) {
    const { context, decision, input, state } = args;
    const attempt = state.beginAction();
    const resolved = await this.resolvePermittedAction(args);
    if (!resolved) return;

    const beforeFingerprint = screenFingerprint(state.observation);
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.tool.started',
      decision.intent,
      {
        uses: resolved.uses,
        targetFingerprint: state.target.fingerprint,
        snapshotId: state.observation.snapshotId,
      },
    );
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.tool.arguments',
      decision.expectedOutcome,
      { uses: resolved.uses, input: resolved.input },
    );
    context.abortSignal?.throwIfAborted();
    let dispatch: ActionDispatch;
    try {
      const result = await context.toolExecutor(
        {
          name: resolved.uses,
          arguments: resolved.input,
          intent: decision.intent,
          expectedOutcome: decision.expectedOutcome,
          envelopeValid: true,
          toolCallId: `action-${attempt}`,
        },
        context.abortSignal,
      );
      dispatch = { result };
    } catch (error) {
      dispatch = { error };
    }

    // A dispatch can reach the device even if its response fails.
    let observed: ObservedScreen | undefined;
    if (resolved.screenMutating) {
      try {
        observed = await this.observe({
          input,
          context,
          deadline: args.deadline,
          reason: `after:${resolved.uses}`,
          uses: resolved.uses,
        });
      } catch (error) {
        await this.recordActionFailure(context, state, resolved.uses, error);
        return 'observation-unavailable' as const;
      }
    }

    if ('error' in dispatch) {
      await this.recordActionFailure(
        context,
        state,
        resolved.uses,
        dispatch.error,
        observed,
      );
      return;
    }
    await this.recordActionResult(
      args,
      resolved,
      dispatch.result,
      beforeFingerprint,
      observed,
    );
  }

  private async resolvePermittedAction(args: ExecuteActionArgs) {
    const { context, decision, input, state } = args;
    if (decision.snapshotId !== state.observation.snapshotId) {
      await this.recordRejectedAction(
        context,
        state,
        decision,
        `Stale snapshot ${decision.snapshotId}; latest is ${state.observation.snapshotId}.`,
      );
      return null;
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
      return null;
    }
    if (
      decision.action.type === 'invoke_capability' &&
      !args.capabilities.some((capability) => capability.uses === resolved.uses)
    ) {
      await this.recordRejectedAction(
        context,
        state,
        decision,
        `Capability ${resolved.uses} was not routed into this run.`,
      );
      return null;
    }
    return resolved;
  }

  private async recordActionResult(
    args: ExecuteActionArgs,
    resolved: ResolvedAction,
    result: ToolResult,
    beforeFingerprint: string,
    observed?: ObservedScreen,
  ) {
    const { context, decision, state } = args;
    const observation = observed?.observation ?? state.observation;
    const structuredFailure = resultIndicatesFailure(result.data ?? {});
    const unchanged =
      resolved.screenMutating &&
      decision.action.type !== 'wait' &&
      beforeFingerprint === screenFingerprint(observation);
    const failed = structuredFailure || unchanged;
    const evidence = state.recordAction(
      `${resolved.uses} (${decision.intent})`,
      {
        kind: resolved.screenMutating ? 'action' : 'typed-result',
        command: resolved.uses,
        summary: unchanged
          ? `${result.summary} Screen did not change.`
          : result.summary,
        ...(observed ? { snapshotId: observation.snapshotId } : {}),
        ...(result.data ? { data: result.data } : {}),
      },
      failed,
      observed,
    );
    await emitAutomationAiEvent(
      this.events,
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
  }

  private async recordActionFailure(
    context: AutomationAiHarnessContext,
    state: DeviceAgentRunState,
    uses: string,
    error: unknown,
    observed?: ObservedScreen,
  ) {
    const message = sanitizeAiText(
      error instanceof Error ? error.message : String(error),
      1_000,
    );
    const evidence = state.recordAction(
      uses,
      {
        kind: 'typed-result',
        summary: message,
        ...(observed ? { snapshotId: observed.observation.snapshotId } : {}),
      },
      true,
      observed,
    );
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.tool.failed',
      message,
      {
        uses,
        evidenceId: evidence.id,
        targetFingerprint: state.target.fingerprint,
      },
    );
  }

  async executeEscalation(
    args: ActionContext & {
      decision: Extract<DeviceAgentDecision, { kind: 'request_escalation' }>;
    },
  ) {
    const { context, decision, input, state } = args;
    const command = validatedEscalationCommand(decision.program, decision.args);
    if (input.rawShellPolicy !== 'allowlisted' || !command) {
      const reason =
        input.rawShellPolicy !== 'allowlisted'
          ? 'Raw ADB shell is disabled for this run.'
          : 'Requested ADB command is outside the read-only escalation allowlist.';
      await emitAutomationAiEvent(
        this.events,
        context,
        'ai.guardrail.triggered',
        reason,
        {
          program: decision.program,
          targetFingerprint: state.target.fingerprint,
        },
      );
      state.recordRejectedDecision('request_escalation', reason);
      return;
    }

    context.abortSignal?.throwIfAborted();
    assertTargetSession(state.target, context);
    const attempt = state.beginAction();
    const result = await context.toolExecutor(
      {
        name: 'android.adbShell',
        arguments: { command, timeoutMs: 10_000 },
        intent: decision.reason,
        expectedOutcome: 'Read-only Android state is returned.',
        envelopeValid: true,
        toolCallId: `escalation-${attempt}`,
      },
      context.abortSignal,
    );
    const failed = resultIndicatesFailure(result.data ?? {});
    const evidence = state.recordAction(
      `allowlisted:${decision.program}`,
      {
        kind: 'typed-result',
        summary: result.summary,
        data: result.data,
      },
      failed,
    );
    await emitAutomationAiEvent(
      this.events,
      context,
      failed ? 'ai.tool.failed' : 'ai.tool.completed',
      result.summary,
      { uses: 'android.adbShell', evidenceId: evidence.id, failed },
    );
  }

  observe({
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
    return this.perception.observe({
      context: { ...context, clientMessageId: input.clientMessageId ?? null },
      input,
      deadline,
      reason,
      uses,
      visionContext: { goal: input.prompt },
    });
  }

  private async recordRejectedAction(
    context: AutomationAiHarnessContext,
    state: DeviceAgentRunState,
    decision: ActDecision,
    reason: string,
  ) {
    state.recordRejectedDecision(decision.action.type, reason);
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.guardrail.triggered',
      reason,
      {
        latestSnapshotId: state.observation.snapshotId,
        targetFingerprint: state.target.fingerprint,
      },
    );
  }
}
