import { AutomationAiHarnessService } from './automation-ai-harness.service';

const createHarness = () =>
  new AutomationAiHarnessService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

const invokeShouldObserveAfterTool = (
  service: AutomationAiHarnessService,
  command: string,
  requiresScreenObservation?: boolean,
) =>
  (
    service as unknown as {
      shouldObserveAfterTool: (input: {
        uses: string;
        toolCall: {
          intent: string;
          expectedOutcome: string;
          input: { command: string };
          requiresScreenObservation?: boolean;
          envelopeValid: boolean;
        };
      }) => Promise<boolean>;
    }
  ).shouldObserveAfterTool({
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
    const service = createHarness();
    const shouldObserve = await invokeShouldObserveAfterTool(
      service,
      'pm list packages',
      false,
    );

    expect(shouldObserve).toBe(false);
  });

  it('captures a follow-up observation when adbShell needs screenshot validation', async () => {
    const service = createHarness();
    const shouldObserve = await invokeShouldObserveAfterTool(
      service,
      'am start -n com.example/.MainActivity',
      true,
    );

    expect(shouldObserve).toBe(true);
  });

  it('defaults to capturing follow-up observation when adbShell flag is missing', async () => {
    const service = createHarness();
    const shouldObserve = await invokeShouldObserveAfterTool(
      service,
      'some strange shell construct',
    );

    expect(shouldObserve).toBe(true);
  });

  it('captures a follow-up observation for non-adb mutating tools', async () => {
    const service = createHarness();
    const shouldObserve =
      await (
        service as unknown as {
          shouldObserveAfterTool: (input: {
            uses: string;
            toolCall: {
              intent: string;
              expectedOutcome: string;
              input: { command: string };
              envelopeValid: boolean;
            };
          }) => Promise<boolean>;
        }
      ).shouldObserveAfterTool({
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
