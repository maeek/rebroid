import type { AutomationToolEnvelopeResult } from '@rebroid/ai-core/harness';
import type { AutomationAiRunInput } from '@rebroid/ai-core/provider';

export const applyRunVisionDefaults = (
  uses: string,
  toolCall: AutomationToolEnvelopeResult,
  input: Pick<AutomationAiRunInput, 'visionProviderId' | 'visionModelId'>,
): AutomationToolEnvelopeResult => {
  if (uses !== 'vision.observe' && uses !== 'vision.locate') {
    return toolCall;
  }
  const nextInput = { ...toolCall.input };
  if (
    input.visionProviderId &&
    typeof nextInput.visionProviderId !== 'string'
  ) {
    nextInput.visionProviderId = input.visionProviderId;
  }
  if (input.visionModelId && typeof nextInput.visionModelId !== 'string') {
    nextInput.visionModelId = input.visionModelId;
  }
  return { ...toolCall, input: nextInput };
};
