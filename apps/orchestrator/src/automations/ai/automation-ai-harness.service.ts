import { BadRequestException, Injectable } from '@nestjs/common';
import type { DeviceAgentDecision } from './core/device-decision';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiActionExecutor } from './automation-ai-action-executor.service';
import { AutomationAiDecisionService } from './automation-ai-decision.service';
import { emitAutomationAiEvent } from './automation-ai-events';
import { verifyAutomationAiFinish } from './automation-ai-finish-verifier';
import { sanitizeAiText } from './automation-ai-observation.utils';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import {
  createTargetSession,
  routeCapabilities,
  shouldPlanInitially,
  type DeviceAgentEvidence,
  type DeviceAgentState,
} from './automation-device-agent-state';

const MAX_PLAN_ATTEMPTS = 2;

@Injectable()
export class AutomationAiHarnessService {
  constructor(
    private readonly aiProviders: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly events: AutomationRunEventBus,
    private readonly decisions: AutomationAiDecisionService,
    private readonly actions: AutomationAiActionExecutor,
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

    const observed = await this.actions.observe({
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
    const decisionContext = {
      input,
      context,
      provider,
      model,
      deadline,
      state,
    };

    if (shouldPlanInitially(input.agentMode ?? 'adaptive', input.prompt)) {
      await this.decisions.updatePlan(decisionContext);
    }

    while (Date.now() < deadline && state.actions < maxActions) {
      this.assertNotCanceled(context.abortSignal);
      const decision = await this.decisions.requestDecision({
        ...decisionContext,
        capabilities,
      });
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
        await this.decisions.updatePlan({
          ...decisionContext,
          reason: decision.reason,
        });
        continue;
      }
      if (decision.kind === 'ask_user') {
        return this.finish(context, input, state, {
          status: 'blocked',
          finalText: decision.question,
          blockedReason: decision.reason,
        });
      }
      if (decision.kind === 'finish') {
        const verified = verifyAutomationAiFinish(decision, state);
        if (!verified.ok) {
          await this.rejectFinish(context, input, state, verified.reason);
          continue;
        }
        state.subgoals = verified.subgoals;
        return this.finish(context, input, state, {
          status: decision.status,
          finalText: decision.finalText,
          blockedReason:
            decision.status === 'blocked'
              ? (decision.reason ?? decision.finalText)
              : null,
        });
      }
      if (decision.kind === 'request_escalation') {
        const executed = await this.actions.executeEscalation({
          decision,
          input,
          context,
          state,
        });
        if (executed) state.actions += 1;
        continue;
      }

      await this.actions.executeAction({
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
        await this.decisions.updatePlan({
          ...decisionContext,
          reason: 'Two consecutive actions failed verification.',
        });
      }
    }

    const timedOut = Date.now() >= deadline;
    return this.finish(context, input, state, {
      status: 'blocked',
      finalText: timedOut
        ? 'The device agent timed out before the requested result was verified.'
        : 'The device agent reached its action limit before the requested result was verified.',
      blockedReason: timedOut
        ? 'Agent timeout reached.'
        : 'Action limit reached.',
    });
  }

  private async rejectFinish(
    context: AutomationAiHarnessContext,
    input: AutomationAiRunInput,
    state: DeviceAgentState,
    reason: string,
  ) {
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.guardrail.triggered',
      reason,
      { clientMessageId: input.clientMessageId ?? null },
    );
    state.trajectory.push({
      action: 'finish',
      outcome: reason,
      evidenceId: state.evidence[0].id,
      failed: true,
    });
    state.consecutiveFailures += 1;
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
    const evidenceIds = state.evidence.map((evidence) => evidence.id);
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
        targetFingerprint: state.target.fingerprint,
        lastSnapshotId: state.observation.snapshotId,
      },
    );
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
