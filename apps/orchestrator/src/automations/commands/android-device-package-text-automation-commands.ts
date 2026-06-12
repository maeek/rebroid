import { z } from 'zod';
import {
  listPackagesSchema,
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
      uses: 'android.launchPackage',
      label: 'Launch package',
      description:
        'Checks whether an Android package is installed, then attempts to launch its launcher activity.',
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
        const pathResult = await adb.shell(
          app,
          `pm path ${packageName}`,
          timeoutMs,
        );
        if (pathResult.exitCode !== 0 || !pathResult.stdout.trim()) {
          return {
            summary: `Package ${packageName} is not installed. Ask the user to install it or choose another route.`,
            data: {
              packageName,
              installed: false,
              launched: false,
              reason:
                (pathResult.stderr || pathResult.stdout).trim() ||
                'Package not found.',
            },
          };
        }

        const launchResult = await adb.shell(
          app,
          `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
          timeoutMs,
        );
        const output = [launchResult.stdout, launchResult.stderr]
          .map((part) => part.trim())
          .filter(Boolean)
          .join('\n');
        const launched = launchResult.exitCode === 0;
        return {
          summary: launched
            ? `Launched ${packageName}.`
            : `Package ${packageName} could not be launched.`,
          data: {
            packageName,
            installed: true,
            launched,
            exitCode: launchResult.exitCode,
            reason: launched ? null : output || 'Launcher activity failed.',
          },
        };
      },
    },
    {
      uses: 'android.waitForText',
      label: 'Wait for text',
      description: 'Polls the UI hierarchy until text appears.',
      requiredPermissions: ['automations:run'],
      schema: textWaitSchema,
      execute: async (
        { text, timeoutMs, intervalMs }: z.infer<typeof textWaitSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        const deadline = Date.now() + timeoutMs;
        do {
          const dump = await adb.dumpUi(app);
          if (dump.xml.includes(text)) {
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
