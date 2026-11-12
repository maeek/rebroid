import {
  resolveActionCommand,
  expectsScreenChange,
  outcomeAllowsEvidence,
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
import type { AutomationCommandDto } from '../dto/automation-command.dto';

const command = (uses: string): AutomationCommandDto => ({
  uses,
  label: uses,
  description: '',
  requiredPermissions: [],
  inputSchema: {},
  outputs: [],
  editor: { inputDefaults: {}, inputFieldOrder: [], yamlSnippetFields: [] },
});

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

  it.each(['Open Żappka', 'Otwórz Żappkę'])(
    'routes screen lookup and package discovery for "%s"',
    (goal) => {
      const commands = [
        'android.getClipboard',
        'android.getSetting',
        'android.deleteFile',
        'android.listFiles',
        'android.rotateDisplay',
        'android.listPackages',
        'vision.observe',
        'vision.locate',
        'flow.stop',
      ].map(command);
      const defaultRoutes = routeCapabilities({ commands, goal, input: {} });
      const explicitRoutes = routeCapabilities({
        commands,
        goal,
        input: { capabilities: commands.map(({ uses }) => uses) },
      });
      expect(defaultRoutes.map(({ uses }) => uses)).toEqual([
        'android.listPackages',
        'vision.locate',
      ]);
      expect(explicitRoutes).toEqual(defaultRoutes);
      expect(
        routeCapabilities({ commands, goal, input: { capabilities: [] } }),
      ).toEqual([]);
      expect(
        routeCapabilities({
          commands,
          goal,
          input: { capabilities: ['android.deleteFile'] },
        }),
      ).toEqual([]);
    },
  );

  it('routes relevant file operations only when explicitly granted', () => {
    const commands = [
      'android.deleteFile',
      'android.listFiles',
      'vision.locate',
    ].map(command);
    const capabilities = commands.map(({ uses }) => uses);
    expect(
      routeCapabilities({
        commands,
        goal: 'List files under /sdcard',
        input: { capabilities },
      }),
    ).toEqual([command('android.listFiles')]);
    expect(
      routeCapabilities({
        commands,
        goal: 'Delete the file in /sdcard',
        input: {},
      }),
    ).toEqual([command('vision.locate')]);
    expect(
      routeCapabilities({
        commands,
        goal: 'Delete the file in /sdcard',
        input: { capabilities },
      }),
    ).toEqual([command('android.deleteFile')]);
  });

  it.each(['Delete /storage/emulated/0/report.txt', 'Usuń zbędny raport'])(
    'keeps an explicitly granted file capability eligible for "%s"',
    (goal) => {
      const commands = ['android.deleteFile', 'vision.locate'].map(command);
      expect(
        routeCapabilities({
          commands,
          goal,
          input: { capabilities: ['android.deleteFile'] },
        }),
      ).toEqual([command('android.deleteFile')]);
    },
  );

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
    ['succeeded', true],
    ['not_found', true],
    ['unsupported', false],
    ['failed', false],
    ['uncertain', false],
  ] as const)('admits evidence for outcome %s', (outcome, expected) => {
    expect(outcomeAllowsEvidence(outcome)).toBe(expected);
  });

  it('refreshes the screen after writing the clipboard without requiring a visual change', () => {
    const action = resolveActionCommand(
      {
        type: 'invoke_capability',
        uses: 'android.setClipboard',
        input: { text: 'Żappka' },
      },
      { candidates: [] },
    );
    expect(action?.screenMutating).toBe(true);
    expect(action && expectsScreenChange(action)).toBe(false);
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
