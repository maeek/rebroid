import { Injectable } from '@nestjs/common';
import type { DeviceAgentDecision } from './core/device-decision';
import { SCREEN_MUTATING_TOOLS } from './automation-ai-observation.utils';
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
  type DeviceAgentEvidence,
  type DeviceAgentState,
} from './automation-device-agent-state';

type ActionContext = {
  input: AutomationAiRunInput;
  context: AutomationAiHarnessContext;
  state: DeviceAgentState;
};

type ActDecision = Extract<DeviceAgentDecision, { kind: 'act' }>;
type ResolvedAction = ReturnType<typeof resolveActionTool>;
type ToolResult = Awaited<
  ReturnType<AutomationAiHarnessContext['toolExecutor']>
>;

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
    const { context, decision, state } = args;
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
    try {
      const result = await context.toolExecutor({
        name: resolved.uses,
        arguments: resolved.input,
        intent: decision.intent,
        expectedOutcome: decision.expectedOutcome,
        envelopeValid: true,
        toolCallId: `action-${state.actions + 1}`,
      });
      await this.recordActionResult(args, resolved, result, beforeFingerprint);
    } catch (error) {
      await this.recordActionFailure(context, state, resolved.uses, error);
    }
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
  ) {
    const { context, decision, input, state } = args;
    const structuredFailure = resultIndicatesFailure(result.data ?? {});
    const shouldObserve =
      resolved.screenMutating || SCREEN_MUTATING_TOOLS.has(resolved.uses);
    if (shouldObserve) {
      const observed = await this.observe({
        input,
        context,
        deadline: args.deadline,
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
      summary: unchanged
        ? `${result.summary} Screen did not change.`
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
    state: DeviceAgentState,
    uses: string,
    error: unknown,
  ) {
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
      action: uses,
      outcome: message,
      evidenceId,
      failed: true,
    });
    state.consecutiveFailures += 1;
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.tool.failed',
      message,
      { uses, evidenceId, targetFingerprint: state.target.fingerprint },
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
    await emitAutomationAiEvent(
      this.events,
      context,
      failed ? 'ai.tool.failed' : 'ai.tool.completed',
      result.summary,
      { uses: 'android.adbShell', evidenceId, failed },
    );
    return true;
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
    state: DeviceAgentState,
    decision: ActDecision,
    reason: string,
  ) {
    state.trajectory.push({
      action: decision.action.type,
      outcome: reason,
      evidenceId: state.evidence[0].id,
      failed: true,
    });
    state.consecutiveFailures += 1;
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
