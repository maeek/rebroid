import type { AutomationToolEnvelopeResult } from '@rebroid/ai-core/harness';
import {
  SCREEN_MUTATING_TOOLS,
  isDangerousAdbShellCommand,
  sanitizeAiText,
} from './automation-ai-observation.utils';

export const shouldObserveAfterTool = ({
  uses,
  toolCall,
}: {
  uses: string;
  toolCall: AutomationToolEnvelopeResult;
}): boolean => {
  if (!SCREEN_MUTATING_TOOLS.has(uses)) {
    return false;
  }

  if (uses !== 'android.adbShell') {
    return true;
  }

  const command =
    typeof toolCall.input.command === 'string' ? toolCall.input.command : '';
  if (!command.trim()) {
    return true;
  }
  if (toolCall.requiresScreenObservation === false) {
    return false;
  }
  return true;
};

export const blockedToolResult = (
  uses: string,
  toolCall: AutomationToolEnvelopeResult,
) => {
  if (uses !== 'android.adbShell') {
    return null;
  }
  const command =
    typeof toolCall.input.command === 'string' ? toolCall.input.command : '';
  if (!isDangerousAdbShellCommand(command)) {
    return null;
  }
  return {
    summary:
      'This adbShell command is blocked because it may modify device state dangerously. Ask the user for a safer route.',
    error:
      'Potentially destructive adbShell command blocked during AI automation.',
    expectedIntent: toolCall.intent.length > 0 ? toolCall.intent : undefined,
    expectedOutcome:
      toolCall.expectedOutcome.length > 0
        ? toolCall.expectedOutcome
        : undefined,
    envelopeValid: toolCall.envelopeValid,
  };
};

export const parseToolCallArguments = (
  uses: string,
  rawArguments: Record<string, unknown>,
): AutomationToolEnvelopeResult => {
  if (!isObjectRecord(rawArguments)) {
    return {
      intent: `Legacy tool call shape for ${uses}.`,
      expectedOutcome: 'Model returned a malformed tool argument object.',
      input: {},
      envelopeValid: false,
    };
  }
  const hasEnvelope =
    typeof rawArguments.intent === 'string' &&
    typeof rawArguments.expectedOutcome === 'string' &&
    rawArguments.input != null &&
    typeof rawArguments.input === 'object' &&
    !Array.isArray(rawArguments.input);
  const requiresScreenObservation =
    typeof rawArguments.requiresScreenObservation === 'boolean'
      ? rawArguments.requiresScreenObservation
      : undefined;
  const requiresScreenObservationWellFormed =
    uses !== 'android.adbShell'
      ? true
      : rawArguments.requiresScreenObservation === undefined ||
        typeof rawArguments.requiresScreenObservation === 'boolean';
  if (!hasEnvelope) {
    const legacyInput = isObjectRecord(rawArguments.input)
      ? rawArguments.input
      : rawArguments;
    return {
      intent:
        typeof rawArguments.intent === 'string'
          ? sanitizeAiText(rawArguments.intent, 140)
          : `Legacy tool call for ${uses}.`,
      expectedOutcome:
        typeof rawArguments.expectedOutcome === 'string'
          ? sanitizeAiText(rawArguments.expectedOutcome, 220)
          : 'No explicit expected outcome was supplied.',
      input: legacyInput,
      requiresScreenObservation: uses === 'android.adbShell' ? true : undefined,
      envelopeValid: false,
    };
  }
  return {
    intent: sanitizeAiText(rawArguments.intent, 140),
    expectedOutcome: sanitizeAiText(rawArguments.expectedOutcome, 220),
    input: rawArguments.input as Record<string, unknown>,
    requiresScreenObservation:
      uses === 'android.adbShell'
        ? (requiresScreenObservation ?? true)
        : undefined,
    envelopeValid: hasEnvelope && requiresScreenObservationWellFormed,
  };
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);
