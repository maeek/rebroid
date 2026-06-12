import { shouldObserveAfterTool } from './automation-ai-tool-policy';

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
});
