import { createAndroidDevicePackageTextAutomationCommands } from './android-device-package-text-automation-commands';

describe('android package automation commands', () => {
  it('launches a package when pm path fails but package listing confirms it exists', async () => {
    const shell = jest
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: 'Package manager help text',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'package:com.android.settings\n',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'Events injected: 1',
        stderr: '',
      });
    const launchPackage =
      createAndroidDevicePackageTextAutomationCommands().find(
        (command) => command.uses === 'android.launchPackage',
      );

    await expect(
      launchPackage?.execute(
        { packageName: 'com.android.settings', timeoutMs: 10_000 },
        { app: { id: 'app_1' }, adb: { shell } } as never,
      ),
    ).resolves.toMatchObject({
      data: {
        packageName: 'com.android.settings',
        installed: true,
        launched: true,
      },
    });
    expect(shell).toHaveBeenNthCalledWith(
      1,
      { id: 'app_1' },
      'pm path com.android.settings',
      10_000,
    );
    expect(shell).toHaveBeenNthCalledWith(
      2,
      { id: 'app_1' },
      'pm list packages com.android.settings',
      10_000,
    );
  });

  it('falls back to the Android settings action when monkey cannot launch Settings', async () => {
    const shell = jest
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'package:/system/priv-app/Settings/Settings.apk',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'No activities found',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'Starting: Intent { act=android.settings.SETTINGS }',
        stderr: '',
      });
    const launchPackage =
      createAndroidDevicePackageTextAutomationCommands().find(
        (command) => command.uses === 'android.launchPackage',
      );

    await expect(
      launchPackage?.execute(
        { packageName: 'com.android.settings', timeoutMs: 10_000 },
        { app: { id: 'app_1' }, adb: { shell } } as never,
      ),
    ).resolves.toMatchObject({
      data: {
        installed: true,
        launched: true,
        exitCode: 0,
      },
    });
    expect(shell).toHaveBeenNthCalledWith(
      3,
      { id: 'app_1' },
      'cmd activity start-activity -a android.settings.SETTINGS',
      10_000,
    );
  });

  it('opens system Settings through typed intent routes', async () => {
    const shell = jest.fn().mockResolvedValueOnce({
      exitCode: 0,
      stdout: 'Events injected: 1',
      stderr: '',
    });
    const openSystemSettings =
      createAndroidDevicePackageTextAutomationCommands().find(
        (command) => command.uses === 'android.openSystemSettings',
      );

    await expect(
      openSystemSettings?.execute({ screen: 'main', timeoutMs: 10_000 }, {
        app: { id: 'app_1' },
        adb: { shell },
      } as never),
    ).resolves.toMatchObject({
      summary: 'Opened Android Settings.',
      data: {
        opened: true,
        screen: 'main',
      },
    });
    expect(shell).toHaveBeenCalledWith(
      { id: 'app_1' },
      'monkey -p com.android.settings -c android.intent.category.LAUNCHER 1',
      10_000,
    );
  });

  it('falls back to Settings intent when package launcher route fails', async () => {
    const shell = jest
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'No activities found',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'Starting: Intent { act=android.settings.SETTINGS }',
        stderr: '',
      });
    const openSystemSettings =
      createAndroidDevicePackageTextAutomationCommands().find(
        (command) => command.uses === 'android.openSystemSettings',
      );

    await expect(
      openSystemSettings?.execute({ screen: 'main', timeoutMs: 10_000 }, {
        app: { id: 'app_1' },
        adb: { shell },
      } as never),
    ).resolves.toMatchObject({
      summary: 'Opened Android Settings.',
      data: {
        opened: true,
        screen: 'main',
      },
    });
    expect(shell).toHaveBeenNthCalledWith(
      2,
      { id: 'app_1' },
      'cmd activity start-activity -a android.settings.SETTINGS',
      10_000,
    );
  });
});
