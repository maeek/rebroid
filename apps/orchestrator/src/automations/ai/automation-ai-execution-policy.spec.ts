import {
  resolveActionCommand,
  resultIndicatesFailure,
} from './automation-ai-action-policy';
import {
  commandAllowedForRun,
  routeCapabilities,
  validatedEscalationCommand,
} from './automation-ai-capability-policy';
import {
  assertTargetSession,
  createTargetSession,
} from './automation-device-target-session';

describe('automation AI execution policy', () => {
  it('rejects a changed target fingerprint', () => {
    const app = {
      id: 'app-1',
      containerId: 'container-1',
      containerName: 'runtime-1',
      networkName: 'network-1',
      adbPort: 5555,
      lastStartedAt: new Date(0),
    };
    const target = createTargetSession(app);

    expect(() =>
      assertTargetSession(target, { ...app, containerId: 'container-2' }),
    ).toThrow('a fresh observation is required');
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
        input: { capabilities: ['android.listPackages', 'android.adbShell'] },
      }).map((command) => command.uses),
    ).toEqual(['android.listPackages']);
    expect(
      commandAllowedForRun(
        { capabilities: ['android.listPackages'] },
        'android.getClipboard',
      ),
    ).toBe(false);
  });

  it.each([
    ['settings', 'android.openSystemSettings', {}],
    ['notifications', 'android.expandNotifications', {}],
    ['quick_settings', 'android.expandQuickSettings', {}],
    ['home', 'android.viewerCommand', { command: 'home' }],
  ] as const)(
    'resolves the %s surface with fresh observation',
    (surface, uses, input) => {
      expect(
        resolveActionCommand(
          { type: 'open_system_surface', surface },
          { candidates: [] },
        ),
      ).toEqual({ uses, input, screenMutating: true });
    },
  );

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
