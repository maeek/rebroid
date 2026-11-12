import { Injectable } from '@nestjs/common';
import type { DeviceAgentDecision } from './core/device-decision';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import type { AutomationCommandResult } from '../commands/automation-command.types';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
import type { AutomationObservedScreen } from '../vision/automation-vision.types';
import {
  resolveActionCommand,
  expectsScreenChange,
  outcomeAllowsEvidence,
  screenFingerprint,
  type ResolvedAiAction,
} from './automation-ai-action-policy';
import {
  commandAllowedForRun,
  validatedEscalationCommand,
  type RoutedAiCapabilities,
} from './automation-ai-capability-policy';
import { emitAutomationAiEvent } from './automation-ai-events';
import { sanitizeAiText } from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import { assertTargetSession } from './automation-device-target-session';
import type { DeviceAgentRunState } from './automation-device-agent-run-state';

type ActionContext = {
  input: AutomationAiRunInput;
  context: AutomationAiHarnessContext;
  state: DeviceAgentRunState;
};

type ActDecision = Extract<DeviceAgentDecision, { kind: 'act' }>;
type ActionDispatch = { result: AutomationCommandResult } | { error: unknown };

type ExecuteActionArgs = ActionContext & {
  decision: ActDecision;
  deadline: number;
  capabilities: RoutedAiCapabilities;
};

@Injectable()
export class AutomationAiActionExecutor {
  constructor(
    private readonly events: AutomationRunEventBus,
    private readonly perception: AutomationPerceptionService,
  ) {}

  async executeAction(args: ExecuteActionArgs) {
    const { context, decision, input, state } = args;
    state.beginAction();
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
      const result = await context.executeCommand({
        uses: resolved.uses,
        input: resolved.input,
        signal: context.abortSignal,
        deadline: args.deadline,
        visionSnapshot: usesCurrentVisionSnapshot(resolved.uses)
          ? state.observation
          : undefined,
      });
      dispatch = { result };
    } catch (error) {
      dispatch = { error };
    }

    // A dispatch can reach the device even if its response fails.
    let observed: AutomationObservedScreen | undefined;
    if (resolved.screenMutating) {
      try {
        observed = await this.perception.observe({
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
    assertTargetSession(state.target, context.app);
    const resolved = resolveActionCommand(
      decision.action,
      state.observationForAction(),
    );
    if (!resolved) {
      await this.recordRejectedAction(
        context,
        state,
        decision,
        'Tap target is missing or stale.',
      );
      return null;
    }
    if (!commandAllowedForRun(input, resolved.uses)) {
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
    resolved: ResolvedAiAction,
    result: AutomationCommandResult,
    beforeFingerprint: string,
    observed?: AutomationObservedScreen,
  ) {
    const { context, decision, state } = args;
    const observation = observed?.observation ?? state.observation;
    const unchanged =
      expectsScreenChange(resolved) &&
      beforeFingerprint === screenFingerprint(observation);
    const commandOutcome = result.outcome ?? 'succeeded';
    const outcome =
      unchanged && commandOutcome === 'succeeded'
        ? 'uncertain'
        : commandOutcome;
    const failed = !outcomeAllowsEvidence(outcome);
    const lookupMatches =
      !failed && resolved.uses === 'vision.locate' && result.snapshotMatches
        ? state.admitLookupMatches(result.snapshotMatches)
        : undefined;
    const data: Record<string, unknown> = {
      ...result.data,
      ...(lookupMatches ? { lookupMatches } : {}),
    };
    if (resolved.uses === 'android.pullFile') delete data.contentBase64;
    const evidence = state.recordAction(
      `${resolved.uses} (${decision.intent})`,
      {
        kind: resolved.screenMutating ? 'action' : 'typed-result',
        command: resolved.uses,
        summary: unchanged
          ? `${result.summary} Screen did not change.`
          : result.summary,
        ...(observed || usesCurrentVisionSnapshot(resolved.uses)
          ? { snapshotId: observation.snapshotId }
          : {}),
        ...(lookupMatches ? { lookupMatches } : {}),
        data,
        outcome,
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
        commandOutcome,
        evidenceOutcome: outcome,
        unchanged,
        targetFingerprint: state.target.fingerprint,
        snapshotId: state.observation.snapshotId,
        data,
      },
    );
  }

  private async recordActionFailure(
    context: AutomationAiHarnessContext,
    state: DeviceAgentRunState,
    uses: string,
    error: unknown,
    observed?: AutomationObservedScreen,
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
      deadline: number;
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
    assertTargetSession(state.target, context.app);
    state.beginAction();
    const result = await context.executeCommand({
      uses: 'android.adbShell',
      input: { command, timeoutMs: 10_000 },
      signal: context.abortSignal,
      deadline: args.deadline,
    });
    const outcome = result.outcome ?? 'succeeded';
    const failed = !outcomeAllowsEvidence(outcome);
    const evidence = state.recordAction(
      `allowlisted:${decision.program}`,
      {
        kind: 'typed-result',
        summary: result.summary,
        data: result.data,
        outcome,
      },
      failed,
    );
    await emitAutomationAiEvent(
      this.events,
      context,
      failed ? 'ai.tool.failed' : 'ai.tool.completed',
      result.summary,
      {
        uses: 'android.adbShell',
        evidenceId: evidence.id,
        failed,
        commandOutcome: outcome,
      },
    );
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

const usesCurrentVisionSnapshot = (uses: string) =>
  uses === 'vision.locate' || uses === 'vision.observe';
