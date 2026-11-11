import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import type { DeviceAgentDecision } from './core/device-decision';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiActionExecutor } from './automation-ai-action-executor.service';
import {
  AutomationAiDecisionService,
  type AutomationAiDecisionContext,
} from './automation-ai-decision.service';
import { emitAutomationAiEvent } from './automation-ai-events';
import { verifyAutomationAiFinish } from './automation-ai-finish-verifier';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import {
  createTargetSession,
  routeCapabilities,
  shouldPlanInitially,
} from './automation-device-agent-state';
import {
  DeviceAgentRunState,
  type DeviceAgentState,
} from './automation-device-agent-run-state';

const MAX_PLAN_ATTEMPTS = 2;

type AutomationAiOutcome = {
  status: 'completed' | 'blocked';
  finalText: string;
  blockedReason: string | null;
  evidenceIds?: string[];
};

@Injectable()
export class AutomationAiHarnessService {
  constructor(
    private readonly aiProviders: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly events: AutomationRunEventBus,
    private readonly decisions: AutomationAiDecisionService,
    private readonly actions: AutomationAiActionExecutor,
  ) {}

  async run(
    input: AutomationAiRunInput,
    runContext: AutomationAiHarnessContext,
  ) {
    const deadline = Date.now() + input.timeoutMs;
    const timeout = AbortSignal.timeout(input.timeoutMs);
    const context = {
      ...runContext,
      abortSignal: runContext.abortSignal
        ? AbortSignal.any([runContext.abortSignal, timeout])
        : timeout,
    };
    let state: DeviceAgentRunState | undefined;
    let outcome: AutomationAiOutcome;
    try {
      context.abortSignal.throwIfAborted();
      const maxActions = input.maxActions;
      const { provider, model, capabilities } = await this.start(
        input,
        context,
        maxActions,
      );
      const observed = await this.actions.observe({
        input,
        context,
        deadline,
        reason: 'initial',
      });
      state = new DeviceAgentRunState(createTargetSession(context), observed);
      outcome = await this.runDecisions(
        { input, context, provider, model, deadline, state },
        capabilities,
        maxActions,
      );
    } catch (error) {
      this.assertNotCanceled(runContext.abortSignal);
      if (
        !timeout.aborted &&
        Date.now() < deadline &&
        !(error instanceof RequestTimeoutException)
      ) {
        throw error;
      }
      outcome = {
        status: 'blocked',
        finalText:
          'The device agent timed out before the requested result was verified.',
        blockedReason: 'Agent timeout reached.',
      };
    }
    return this.finish(context, input, state, outcome);
  }

  private async start(
    input: AutomationAiRunInput,
    context: AutomationAiHarnessContext,
    maxActions: number,
  ) {
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
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.model.started',
      'Device agent started.',
      {
        providerId: provider.id,
        modelId: model.id,
        protocol: provider.protocol ?? 'openai-chat-completions',
        capabilityCount: capabilities.length,
        actionLimit: maxActions,
        clientMessageId: input.clientMessageId ?? null,
      },
    );

    return { provider, model, capabilities };
  }

  private async runDecisions(
    decisionContext: AutomationAiDecisionContext & {
      context: AutomationAiHarnessContext & { abortSignal: AbortSignal };
    },
    capabilities: ReturnType<typeof routeCapabilities>,
    maxActions: number,
  ): Promise<AutomationAiOutcome> {
    const { input, context, deadline, state } = decisionContext;
    if (shouldPlanInitially(input.agentMode ?? 'adaptive', input.prompt)) {
      await this.decisions.updatePlan(decisionContext);
    }

    const maxTurns = maxActions * 2 + MAX_PLAN_ATTEMPTS + 1;
    for (let turn = 0; turn < maxTurns && Date.now() < deadline; turn += 1) {
      const terminalOnly = state.actions >= maxActions;
      this.assertNotCanceled(context.abortSignal);
      const decision = await this.decisions.requestDecision({
        ...decisionContext,
        capabilities,
        terminalOnly,
      });
      context.abortSignal.throwIfAborted();
      await emitAutomationAiEvent(
        this.events,
        context,
        'ai.action.decided',
        decisionSummary(decision),
        {
          kind: decision.kind,
          snapshotId:
            decision.kind === 'act'
              ? decision.snapshotId
              : state.observation.snapshotId,
          targetFingerprint: state.target.fingerprint,
          clientMessageId: input.clientMessageId ?? null,
        },
      );

      context.abortSignal.throwIfAborted();
      if (Date.now() >= deadline) break;
      if (
        terminalOnly &&
        decision.kind !== 'finish' &&
        decision.kind !== 'ask_user'
      )
        break;

      if (decision.kind === 'needs_plan') {
        if (state.planAttempts >= MAX_PLAN_ATTEMPTS) {
          state.recordRejectedDecision(
            'needs_plan',
            'Planner budget exhausted; choose a concrete action or finish blocked.',
            false,
          );
          continue;
        }
        await this.decisions.updatePlan({
          ...decisionContext,
          reason: decision.reason,
        });
        continue;
      }
      if (decision.kind === 'ask_user') {
        return {
          status: 'blocked',
          finalText: decision.question,
          blockedReason: decision.reason,
        };
      }
      if (decision.kind === 'finish') {
        const verified = verifyAutomationAiFinish(decision, state);
        if (!verified.ok) {
          await this.rejectFinish(context, input, state, verified.reason);
          if (terminalOnly) break;
          continue;
        }
        state.setSubgoals(verified.subgoals);
        return {
          status: decision.status,
          finalText: decision.finalText,
          evidenceIds: verified.evidenceIds,
          blockedReason:
            decision.status === 'blocked'
              ? (decision.reason ?? decision.finalText)
              : null,
        };
      }
      if (decision.kind === 'request_escalation') {
        await this.actions.executeEscalation({
          decision,
          input,
          context,
          state,
        });
        continue;
      }

      const actionResult = await this.actions.executeAction({
        decision,
        input,
        context,
        deadline,
        state,
        capabilities,
      });
      context.abortSignal.throwIfAborted();
      if (actionResult === 'observation-unavailable') {
        this.assertNotCanceled(context.abortSignal);
        return {
          status: 'blocked',
          finalText:
            'The device agent could not observe the screen after the last action.',
          blockedReason: 'A fresh screen observation is unavailable.',
        };
      }
      if (
        state.actions < maxActions &&
        state.consecutiveFailures >= 2 &&
        state.planAttempts < MAX_PLAN_ATTEMPTS &&
        input.agentMode !== 'controller'
      ) {
        await this.decisions.updatePlan({
          ...decisionContext,
          reason: 'Two consecutive actions failed verification.',
        });
      }
    }

    let blockedReason = 'Controller turn limit reached.';
    if (state.actions >= maxActions) blockedReason = 'Action limit reached.';
    if (Date.now() >= deadline) blockedReason = 'Agent timeout reached.';
    return {
      status: 'blocked',
      finalText: `${blockedReason} The requested result could not be verified.`,
      blockedReason,
    };
  }

  private async rejectFinish(
    context: AutomationAiHarnessContext,
    input: AutomationAiRunInput,
    state: DeviceAgentRunState,
    reason: string,
  ) {
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.guardrail.triggered',
      reason,
      { clientMessageId: input.clientMessageId ?? null },
    );
    state.recordRejectedDecision('finish', reason);
  }

  private async finish(
    context: AutomationAiHarnessContext,
    input: AutomationAiRunInput,
    state: DeviceAgentState | undefined,
    result: AutomationAiOutcome,
  ) {
    const finalText = sanitizeAiText(result.finalText, 4_000);
    const evidenceIds = result.evidenceIds ?? [];
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.message.completed',
      finalText,
      {
        status: result.status,
        completed: result.status === 'completed',
        clientMessageId: input.clientMessageId ?? null,
        evidenceIds,
        targetFingerprint: state?.target.fingerprint ?? null,
        lastSnapshotId: state?.observation.snapshotId ?? null,
      },
    );
    return {
      summary: finalText,
      data: {
        finalText,
        status: result.status,
        completed: result.status === 'completed',
        toolCalls: state?.actions ?? 0,
        blockedReason: result.blockedReason,
        evidence: {
          actionCount: state?.actions ?? 0,
          actionLimitReached: (state?.actions ?? 0) >= input.maxActions,
          lastSnapshotId: state?.observation.snapshotId ?? null,
          targetFingerprint: state?.target.fingerprint ?? null,
          verifierFailures:
            state?.trajectory.filter((entry) => entry.failed).length ?? 0,
          evidenceIds,
        },
      },
    };
  }

  private assertNotCanceled(abortSignal?: AbortSignal) {
    if (abortSignal?.aborted) {
      throw new BadRequestException('AI automation was canceled.');
    }
  }
}

const decisionSummary = (decision: DeviceAgentDecision) => {
  if (decision.kind === 'act') {
    return `${decision.action.type}: ${decision.intent}`;
  }
  if (decision.kind === 'finish') return `finish:${decision.status}`;
  if (decision.kind === 'ask_user') return decision.question;
  return decision.reason;
};
