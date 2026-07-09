import { Injectable } from '@nestjs/common';
import {
  buildExecutePlanMessage,
  buildReplanMessage,
  normalizePublicAiText,
  summarizeObservationCandidates,
  summarizeVisualAffordances,
  type ChatMessage,
} from '@rebroid/ai-core/harness';
import type { AutomationAiRunInput } from '@rebroid/ai-core/provider';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { sanitizeAiText } from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import { textContent } from './automation-ai-message.utils';

@Injectable()
export class AutomationAiHarnessRuntimeService {
  constructor(
    private readonly events: AutomationRunEventBus,
    private readonly perception: AutomationPerceptionService,
    private readonly chatClient: AutomationAiChatClientService,
  ) {}

  observeScreen({
    context,
    input,
    deadline,
    reason,
    uses,
    visionContext,
  }: {
    context: AutomationAiHarnessContext;
    input: Pick<
      AutomationAiRunInput,
      'clientMessageId' | 'visionProviderId' | 'visionModelId'
    >;
    deadline: number;
    reason: string;
    uses?: string;
    visionContext?: Parameters<
      AutomationPerceptionService['observe']
    >[0]['visionContext'];
  }) {
    return this.perception.observe({
      context: { ...context, clientMessageId: input.clientMessageId ?? null },
      input,
      deadline,
      reason,
      uses,
      visionContext,
    });
  }

  plannerObservationText(
    observation: Awaited<ReturnType<AutomationPerceptionService['observe']>>,
    confirmedFacts: string[],
    goal: string,
  ) {
    const plannerText = [
      observation.plannerText,
      summarizeObservationCandidates({
        candidates: observation.observation.candidates ?? [],
        goal,
        maxCandidates: 12,
      }),
      summarizeVisualAffordances({
        state: observation.observation.screenState ?? null,
        goal,
      }),
    ]
      .filter(Boolean)
      .join('\n\n');
    const visibleFacts = confirmedFacts.slice(-12);
    if (visibleFacts.length === 0) return plannerText;
    return [
      'Confirmed tool facts:',
      ...visibleFacts.map((fact) => `- ${fact}`),
      '',
      plannerText,
    ].join('\n');
  }

  async replan({
    context,
    input,
    provider,
    model,
    messages,
    deadline,
    reason,
    observation,
  }: {
    context: AutomationAiHarnessContext;
    input: Pick<AutomationAiRunInput, 'clientMessageId'>;
    provider: Parameters<AutomationAiChatClientService['chat']>[0]['provider'];
    model: Parameters<AutomationAiChatClientService['chat']>[0]['model'];
    messages: ChatMessage[];
    deadline: number;
    reason: string;
    observation?: string;
  }) {
    const request = buildReplanMessage({ reason, observation });
    const plan = await this.requestNoToolText({
      provider,
      model,
      messages: [...messages, request],
      deadline,
      abortSignal: context.abortSignal,
      fallback: `Plan update: ${reason}`,
    });
    await this.emit(context, 'ai.plan.updated', plan, {
      reason,
      clientMessageId: input.clientMessageId ?? null,
    });
    messages.push(request, { role: 'assistant', content: plan });
    messages.push(buildExecutePlanMessage(plan));
  }

  async requestNoToolText({
    provider,
    model,
    messages,
    deadline,
    abortSignal,
    fallback,
  }: {
    provider: Parameters<AutomationAiChatClientService['chat']>[0]['provider'];
    model: Parameters<AutomationAiChatClientService['chat']>[0]['model'];
    messages: ChatMessage[];
    deadline: number;
    abortSignal?: AbortSignal;
    fallback: string;
  }) {
    const response = await this.chatClient.chat({
      provider,
      model,
      messages,
      tools: [],
      deadline,
      abortSignal,
    });
    const content = textContent(response.choices?.[0]?.message?.content).trim();
    return normalizePublicAiText(sanitizeAiText(content || fallback, 4_000));
  }

  emit(
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
}
