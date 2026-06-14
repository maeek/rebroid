import {
  parseToolCallArguments,
  shouldObserveAfterTool,
} from './automation-ai-tool-policy';
import { applyRunVisionDefaults } from './automation-ai-vision-tool-defaults';

const invokeShouldObserveAfterTool = (
  command: string,
  requiresScreenObservation?: boolean,
) =>
  shouldObserveAfterTool({
    uses: 'android.adbShell',
    toolCall: {
      intent: 'Inspect',
      expectedOutcome: 'Read output',
      input: { command },
      requiresScreenObservation,
      envelopeValid: true,
    },
  });

describe('AutomationAiHarnessService', () => {
  it('does not capture follow-up observation when adbShell says no screenshot needed', async () => {
    const shouldObserve = invokeShouldObserveAfterTool(
      'pm list packages',
      false,
    );

    expect(shouldObserve).toBe(false);
  });

  it('captures a follow-up observation when adbShell needs screenshot validation', async () => {
    const shouldObserve = invokeShouldObserveAfterTool(
      'am start -n com.example/.MainActivity',
      true,
    );

    expect(shouldObserve).toBe(true);
  });

  it('defaults to capturing follow-up observation when adbShell flag is missing', async () => {
    const shouldObserve = invokeShouldObserveAfterTool(
      'some strange shell construct',
    );

    expect(shouldObserve).toBe(true);
  });

  it('captures a follow-up observation for non-adb mutating tools', async () => {
    const shouldObserve = shouldObserveAfterTool({
      uses: 'android.tap',
      toolCall: {
        intent: 'Tap',
        expectedOutcome: 'Open',
        input: { command: 'tap' },
        envelopeValid: true,
      },
    });

    expect(shouldObserve).toBe(true);
  });

  it('accepts raw tool arguments as legacy command input', () => {
    const parsed = parseToolCallArguments('vision.locate', {
      query: 'Downloads',
      maxResults: 3,
    });

    expect(parsed.envelopeValid).toBe(false);
    expect(parsed.input).toEqual({ query: 'Downloads', maxResults: 3 });
  });

  it('accepts nested legacy input without full envelope metadata', () => {
    const parsed = parseToolCallArguments('vision.locate', {
      input: { query: 'Downloads' },
    });

    expect(parsed.envelopeValid).toBe(false);
    expect(parsed.input).toEqual({ query: 'Downloads' });
  });

  it('injects selected run vision defaults into vision tools', () => {
    const parsed = applyRunVisionDefaults(
      'vision.locate',
      {
        intent: 'Find downloads',
        expectedOutcome: 'Downloads text is located',
        input: { query: 'Downloads' },
        envelopeValid: false,
      },
      { visionProviderId: 'vision-provider', visionModelId: 'vision-model' },
    );

    expect(parsed.input).toEqual({
      query: 'Downloads',
      visionProviderId: 'vision-provider',
      visionModelId: 'vision-model',
    });
  });

  it('does not overwrite explicit vision tool provider input', () => {
    const parsed = applyRunVisionDefaults(
      'vision.observe',
      {
        intent: 'Observe screen',
        expectedOutcome: 'Screen state is captured',
        input: { visionProviderId: 'explicit-provider' },
        envelopeValid: true,
      },
      { visionProviderId: 'run-provider', visionModelId: 'run-model' },
    );

    expect(parsed.input).toEqual({
      visionProviderId: 'explicit-provider',
      visionModelId: 'run-model',
    });
  });
});
