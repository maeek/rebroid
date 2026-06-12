import { AutomationAiRuntimeContextService } from './automation-ai-runtime-context.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';

const createContext = (
  shell: jest.Mock,
  app: { name?: string; apkPackageName?: string | null } = {},
) =>
  ({
    app: {
      name: app.name ?? 'Demo App',
      apkPackageName:
        'apkPackageName' in app ? app.apkPackageName : 'com.demo.recorded',
    },
    adb: { shell },
  }) as unknown as AutomationAiHarnessContext;

describe('AutomationAiRuntimeContextService', () => {
  it('lists sorted third-party packages with recorded package guidance', async () => {
    const shell = jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'package:com.zeta\npackage:com.alpha\n',
      stderr: '',
    });

    const result =
      await new AutomationAiRuntimeContextService().buildForPlanner(
        createContext(shell),
      );

    expect(result).toContain('- Rebroid app name: Demo App');
    expect(result).toContain(
      '- Recorded uploaded APK package: com.demo.recorded',
    );
    expect(result).toContain(
      '- Installed third-party packages (2/2): com.alpha, com.zeta.',
    );
    expect(shell).toHaveBeenCalledWith(
      expect.anything(),
      'pm list packages -3',
      5_000,
    );
  });

  it('falls back to cmd package listing when pm listing fails', async () => {
    const shell = jest
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'pm unavailable',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'package:com.fallback\n',
        stderr: '',
      });

    const result =
      await new AutomationAiRuntimeContextService().buildForPlanner(
        createContext(shell, { apkPackageName: null }),
      );

    expect(result).toContain('- Recorded uploaded APK package: none');
    expect(result).toContain(
      '- Installed third-party packages (1/1): com.fallback.',
    );
    expect(shell).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'cmd package list packages -3',
      5_000,
    );
  });

  it('limits package context to 25 visible packages', async () => {
    const packages = Array.from(
      { length: 27 },
      (_, index) => `package:com.example.${String(index).padStart(2, '0')}`,
    ).join('\n');
    const shell = jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: packages,
      stderr: '',
    });

    const result =
      await new AutomationAiRuntimeContextService().buildForPlanner(
        createContext(shell),
      );

    expect(result).toContain('Installed third-party packages (25/27)');
    expect(result).toContain('2 more omitted');
    expect(result).not.toContain('com.example.26');
  });
});
