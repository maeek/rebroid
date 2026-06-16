import { z } from 'zod';
import {
  listPackagesSchema,
  openSystemSettingsSchema,
  packageNameSchema,
  textWaitSchema,
} from './android-automation-command-schemas';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

export const createAndroidDevicePackageTextAutomationCommands = () =>
  [
    {
      uses: 'android.listPackages',
      label: 'List packages',
      description:
        'Lists installed Android packages, optionally filtered by package-name text.',
      aiTool: {
        label: 'List installed Android packages',
        description:
          'Reads installed package names for app discovery. Use this to confirm package IDs before launchPackage; it does not inspect visible screen text or app-drawer icons.',
      },
      requiredPermissions: ['automations:run'],
      schema: listPackagesSchema,
      outputs: [
        {
          key: 'packages',
          label: 'Packages',
          type: 'array',
          description: 'Matching Android package names.',
        },
        {
          key: 'total',
          label: 'Total',
          type: 'number',
          description: 'Total matching packages before maxResults truncation.',
        },
        {
          key: 'truncated',
          label: 'Truncated',
          type: 'boolean',
          description: 'Whether more matching packages were omitted.',
        },
      ],
      execute: async (
        {
          includeSystem,
          maxResults,
          query,
          timeoutMs,
        }: z.infer<typeof listPackagesSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        let result = await adb.shell(
          app,
          `pm list packages${includeSystem ? '' : ' -3'}`,
          timeoutMs,
        );
        if (result.exitCode !== 0) {
          result = await adb.shell(
            app,
            `cmd package list packages${includeSystem ? '' : ' -3'}`,
            timeoutMs,
          );
        }
        if (result.exitCode !== 0) {
          return {
            summary: `Package list unavailable: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`,
            data: {
              packages: [],
              total: 0,
              truncated: false,
              includeSystem,
              query,
              exitCode: result.exitCode,
            },
          };
        }
        const normalizedQuery = query.trim().toLowerCase();
        const packages = result.stdout
          .split(/\r?\n/)
          .map((line) => line.trim().replace(/^package:/, ''))
          .filter(Boolean)
          .filter((packageName) =>
            normalizedQuery
              ? packageName.toLowerCase().includes(normalizedQuery)
              : true,
          )
          .sort((left, right) => left.localeCompare(right));
        const visiblePackages = packages.slice(0, maxResults);
        return {
          summary: `Found ${packages.length} package(s)${query ? ` matching "${query}"` : ''}.`,
          data: {
            packages: visiblePackages,
            total: packages.length,
            truncated: packages.length > visiblePackages.length,
            includeSystem,
            query,
          },
        };
      },
    },
    {
      uses: 'android.openSystemSettings',
      label: 'Open Android Settings',
      description:
        'Opens the Android system Settings main screen using typed, internally managed Android intent routes.',
      aiTool: {
        label: 'Open Android Settings app',
        description:
          'Attempts to open the Android system Settings app/main screen through typed intent/package routes. Use this before visual app-drawer fallback when the goal is system Settings.',
      },
      requiredPermissions: ['automations:run-adb-shell'],
      schema: openSystemSettingsSchema,
      outputs: [
        {
          key: 'opened',
          label: 'Opened',
          type: 'boolean',
          description: 'Whether Android accepted a Settings launch route.',
        },
        {
          key: 'attempts',
          label: 'Attempts',
          type: 'array',
          description: 'Sanitized Settings launch routes attempted.',
        },
      ],
      execute: async (
        { timeoutMs }: z.infer<typeof openSystemSettingsSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        const attempts = [];
        for (const command of [
          'monkey -p com.android.settings -c android.intent.category.LAUNCHER 1',
          'cmd activity start-activity -a android.settings.SETTINGS',
          'am start -a android.settings.SETTINGS',
        ]) {
          const result = await adb.shell(app, command, timeoutMs);
          attempts.push({
            command,
            exitCode: result.exitCode,
            output: compactShellOutput(result.stdout, result.stderr),
          });
          if (result.exitCode === 0) {
            return {
              summary: 'Opened Android Settings.',
              data: { opened: true, screen: 'main', attempts },
            };
          }
        }
        return {
          summary: 'Android Settings could not be opened by typed routes.',
          data: {
            opened: false,
            screen: 'main',
            attempts,
            failureCategory: 'not_found',
            recoveryHint:
              'Use package discovery, quick settings, visible UI navigation, or ask the user for the available settings surface.',
          },
        };
      },
    },
    {
      uses: 'android.launchPackage',
      label: 'Launch package',
      description:
        'Checks whether an Android package is installed, then attempts to launch its launcher activity.',
      aiTool: {
        label: 'Launch confirmed Android package',
        description:
          'Launches a known installed package ID. Do not guess package names; use listPackages or confirmed runtime context first.',
      },
      requiredPermissions: ['automations:run'],
      schema: packageNameSchema,
      outputs: [
        {
          key: 'installed',
          label: 'Installed',
          type: 'boolean',
          description: 'Whether the package exists on the Android device.',
        },
        {
          key: 'launched',
          label: 'Launched',
          type: 'boolean',
          description: 'Whether Android accepted the launch request.',
        },
        {
          key: 'reason',
          label: 'Reason',
          type: 'string',
          description: 'Failure reason when the package could not be launched.',
        },
      ],
      execute: async (
        { packageName, timeoutMs }: z.infer<typeof packageNameSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        const installCheck = await checkPackageInstalled(
          app,
          adb,
          packageName,
          timeoutMs,
        );
        if (!installCheck.installed) {
          return {
            summary: `Package ${packageName} is not installed. Ask the user to install it or choose another route.`,
            data: {
              packageName,
              installed: false,
              launched: false,
              reason: installCheck.reason,
            },
          };
        }

        const launchResult = await adb.shell(
          app,
          `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
          timeoutMs,
        );
        let output = [launchResult.stdout, launchResult.stderr]
          .map((part) => part.trim())
          .filter(Boolean)
          .join('\n');
        let launched = launchResult.exitCode === 0;
        let exitCode = launchResult.exitCode;

        if (!launched && packageName === 'com.android.settings') {
          const settingsResult = await adb.shell(
            app,
            'cmd activity start-activity -a android.settings.SETTINGS',
            timeoutMs,
          );
          output = [settingsResult.stdout, settingsResult.stderr]
            .map((part) => part.trim())
            .filter(Boolean)
            .join('\n');
          launched = settingsResult.exitCode === 0;
          exitCode = settingsResult.exitCode;
        }

        return {
          summary: launched
            ? `Launched ${packageName}.`
            : `Package ${packageName} could not be launched.`,
          data: {
            packageName,
            installed: true,
            launched,
            exitCode,
            reason: launched ? null : output || 'Launcher activity failed.',
          },
        };
      },
    },
    {
      uses: 'android.waitForText',
      label: 'Wait for text',
      description: 'Polls the UI hierarchy until text appears.',
      aiTool: {
        label: 'Wait for UI hierarchy text',
        description:
          'Waits for exact text in Android UI hierarchy XML. Use only when the latest observation says UI hierarchy is available with nodes; it cannot read OCR-only or vision-only text.',
      },
      requiredPermissions: ['automations:run'],
      schema: textWaitSchema,
      execute: async (
        { text, timeoutMs, intervalMs }: z.infer<typeof textWaitSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        const deadline = Date.now() + timeoutMs;
        do {
          const dump = await adb.dumpUi(app);
          if (dump.status === 'available' && dump.xml?.includes(text)) {
            return { summary: `Found text "${text}".` };
          }
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        } while (Date.now() < deadline);
        throw new Error(`Text "${text}" was not found within ${timeoutMs}ms.`);
      },
    },
    {
      uses: 'android.tapText',
      label: 'Tap text',
      description: 'Finds visible UI text and taps its bounds center.',
      aiTool: {
        label: 'Tap UI hierarchy text',
        description:
          'Taps exact text found in Android UI hierarchy XML. Use only when the latest observation says UI hierarchy is available with nodes; for screenshots/OCR/vision-only targets use locate or coordinates.',
      },
      requiredPermissions: ['automations:run'],
      schema: textWaitSchema,
      outputs: [
        {
          key: 'x',
          label: 'X coordinate',
          type: 'number',
          description: 'Tapped horizontal coordinate.',
        },
        {
          key: 'y',
          label: 'Y coordinate',
          type: 'number',
          description: 'Tapped vertical coordinate.',
        },
      ],
      execute: async (
        { text, timeoutMs, intervalMs }: z.infer<typeof textWaitSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        const deadline = Date.now() + timeoutMs;
        do {
          const result = await adb.tapText(app, text);
          if (result.found) {
            return {
              summary: `Tapped text "${text}".`,
              data: { x: result.x, y: result.y },
            };
          }
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        } while (Date.now() < deadline);
        throw new Error(`Text "${text}" was not found within ${timeoutMs}ms.`);
      },
    },
  ] as unknown as AutomationCommandDefinition[];

const checkPackageInstalled = async (
  app: AutomationCommandContext['app'],
  adb: AutomationCommandContext['adb'],
  packageName: string,
  timeoutMs: number,
) => {
  const pathResult = await adb.shell(app, `pm path ${packageName}`, timeoutMs);
  if (pathResult.exitCode === 0 && pathResult.stdout.trim()) {
    return { installed: true, reason: null };
  }

  for (const command of [
    `pm list packages ${packageName}`,
    `cmd package list packages ${packageName}`,
  ]) {
    const listResult = await adb.shell(app, command, timeoutMs);
    if (
      listResult.exitCode === 0 &&
      listResult.stdout
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^package:/, ''))
        .includes(packageName)
    ) {
      return { installed: true, reason: null };
    }
  }

  return {
    installed: false,
    reason:
      (pathResult.stderr || pathResult.stdout).trim() || 'Package not found.',
  };
};

const compactShellOutput = (stdout: string, stderr: string) => {
  const output = [stdout, stderr]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n');
  if (!output) return '';
  if (looksLikeShellHelp(output)) return 'Android command help text.';
  return output.length > 300 ? `${output.slice(0, 300)}...` : output;
};

const looksLikeShellHelp = (text: string) => {
  const normalized = text.toLowerCase();
  return (
    /\busage:\s/.test(normalized) ||
    /\bcommands:\s/.test(normalized) ||
    normalized.includes('print this help text') ||
    normalized.includes('no service specified; use -l to list')
  );
};
