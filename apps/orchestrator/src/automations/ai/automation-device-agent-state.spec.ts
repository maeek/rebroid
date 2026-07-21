import type { AutomationAiHarnessContext } from './automation-ai.types';
import {
  assertTargetSession,
  createTargetSession,
  resultIndicatesFailure,
  routeCapabilities,
  toolAllowedForRun,
  validatedEscalationCommand,
} from './automation-device-agent-state';

const context = (): AutomationAiHarnessContext =>
  ({
    runId: 'run-1',
    ownerUserId: 'owner-1',
    stepId: 'ai-run',
    path: '$',
    app: {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'runtime-1',
      networkName: 'network-1',
      adbPort: 5555,
    },
    toolExecutor: jest.fn(),
  }) as never;

describe('automation device agent state', () => {
  it('rejects a changed target fingerprint', () => {
    const current = context();
    const target = createTargetSession(current);
    current.app.containerId = 'container-2';

    expect(() => assertTargetSession(target, current)).toThrow(
      'a fresh observation is required',
    );
  });

  it('routes only explicitly permitted typed capabilities', () => {
    const commands = [
      {
        uses: 'android.listPackages',
        label: 'List packages',
        description: 'List installed packages',
        inputSchema: { type: 'object' },
      },
      {
        uses: 'android.adbShell',
        label: 'Shell',
        description: 'Run ADB shell',
        inputSchema: { type: 'object' },
      },
      {
        uses: 'android.getClipboard',
        label: 'Clipboard',
        description: 'Read clipboard',
        inputSchema: { type: 'object' },
      },
    ] as never;

    expect(
      routeCapabilities({
        commands,
        goal: 'List installed packages',
        input: { capabilities: ['android.listPackages'] },
      }).map((command) => command.uses),
    ).toEqual(['android.listPackages']);
    expect(
      toolAllowedForRun(
        { capabilities: ['android.listPackages'] },
        'android.getClipboard',
      ),
    ).toBe(false);
  });

  it.each([
    [{ failed: true }, true],
    [{ success: false }, true],
    [{ exitCode: 1 }, true],
    [{ opened: false }, true],
    [{ failureCategory: 'transport' }, true],
    [{ success: true, exitCode: 0 }, false],
  ])('classifies structured command outcomes', (result, expected) => {
    expect(resultIndicatesFailure(result)).toBe(expected);
  });

  it('allows only validated read-only shell escalation commands', () => {
    expect(validatedEscalationCommand('getprop', ['ro.product.model'])).toBe(
      'getprop ro.product.model',
    );
    expect(validatedEscalationCommand('settings', ['put', 'secure', 'x'])).toBe(
      null,
    );
    expect(validatedEscalationCommand('sh', ['-c', 'id'])).toBeNull();
    expect(validatedEscalationCommand('getprop', ['value;rm'])).toBeNull();
  });
});
