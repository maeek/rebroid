import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';

type AutomationAiEventType = Parameters<
  AutomationRunEventBus['emit']
>[0]['type'];

export const emitAutomationAiEvent = (
  events: AutomationRunEventBus,
  context: AutomationAiHarnessContext,
  type: AutomationAiEventType,
  message: string,
  data: Record<string, unknown> = {},
) =>
  events.emit({
    runId: context.runId,
    ownerUserId: context.ownerUserId,
    type,
    stepId: context.stepId,
    parentStepId: context.parentStepId ?? null,
    message,
    data,
  });
