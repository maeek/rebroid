import { createAndroidDevicePackageTextAutomationCommands } from './android-device-package-text-automation-commands';

describe('android package automation commands', () => {
  it.each([true, false])(
    'fails only when launch success is required (%s)',
    async (requireSuccess) => {
      const shell = jest
        .fn()
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'package:/data/app/base.apk',
          stderr: '',
        })
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: '',
          stderr: 'No launcher activity',
        });
      const launchPackage =
        createAndroidDevicePackageTextAutomationCommands().find(
          (command) => command.uses === 'android.launchPackage',
        )!;
      const result = launchPackage.execute(
        launchPackage.schema.parse({
          packageName: 'com.example.app',
          requireSuccess,
        }),
        { app: { id: 'app_1' }, adb: { shell } } as never,
      );

      if (requireSuccess) {
        await expect(result).rejects.toThrow(
          'Android could not launch package com.example.app',
        );
      } else {
        await expect(result).resolves.toMatchObject({
          data: {
            installed: true,
            launched: false,
            reason: 'No launcher activity',
          },
        });
      }
    },
  );

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
      undefined,
      undefined,
    );
    expect(shell).toHaveBeenNthCalledWith(
      2,
      { id: 'app_1' },
      'pm list packages com.android.settings',
      10_000,
      undefined,
      undefined,
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
      undefined,
      undefined,
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
      undefined,
      undefined,
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
      undefined,
      undefined,
    );
  });
});

describe('android text automation commands', () => {
  it.each([
    ['android.waitForText', 'not_found', 'not_found'],
    ['android.tapText', 'tap_outcome_unknown', 'uncertain'],
  ])(
    'retains the %s outcome when the step fails',
    async (uses, status, outcome) => {
      const command = createAndroidDevicePackageTextAutomationCommands().find(
        (item) => item.uses === uses,
      )!;
      const input = command.schema.parse({ text: 'Żappka' });
      await expect(
        command.execute(input, {
          adb: { uiText: jest.fn().mockResolvedValue({ status }) },
        } as never),
      ).rejects.toMatchObject({ outcome });
    },
  );

  it.each([
    ['android.waitForText', 'wait'],
    ['android.tapText', 'tap'],
  ])(
    'sends the same label and timeout policy for %s',
    async (uses, operation) => {
      const command = createAndroidDevicePackageTextAutomationCommands().find(
        (command) => command.uses === uses,
      )!;
      const uiText = jest
        .fn()
        .mockResolvedValue({ status: 'found', x: 12, y: 34 });
      const app = { id: 'app_1' };
      const abortSignal = new AbortController().signal;
      const input = command.schema.parse({
        text: 'Żappka',
        timeoutMs: 15000,
        intervalMs: 500,
      });
      const result = await command.execute(input, {
        app,
        adb: { uiText },
        abortSignal,
      } as never);

      expect(uiText).toHaveBeenCalledWith(
        app,
        {
          text: 'Żappka',
          match: 'exact',
          timeoutMs: 15000,
          intervalMs: 500,
          operation,
        },
        abortSignal,
      );
      if (operation === 'tap') expect(result.data).toEqual({ x: 12, y: 34 });
    },
  );
});
