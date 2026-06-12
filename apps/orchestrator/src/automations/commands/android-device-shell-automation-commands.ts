import { z } from 'zod';
import {
  androidSettingSchema,
  shellSchema,
} from './android-automation-command-schemas';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

export const createAndroidDeviceShellAutomationCommands = () =>
  [
    {
      uses: 'android.getSetting',
      label: 'Get Android setting',
      description:
        'Reads one Android setting with settings get <namespace> <key>.',
      requiredPermissions: ['automations:run-adb-shell'],
      schema: androidSettingSchema,
      outputs: [
        {
          key: 'value',
          label: 'Value',
          type: 'string',
          description: 'Setting value returned by Android.',
        },
      ],
      execute: async (
        { key, namespace, timeoutMs }: z.infer<typeof androidSettingSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        const result = await adb.shell(
          app,
          `settings get ${namespace} ${key}`,
          timeoutMs,
        );
        if (result.exitCode !== 0) {
          throw new Error(
            `settings get ${namespace} ${key} failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`,
          );
        }
        const value = result.stdout.trim();
        return {
          summary: `Read Android ${namespace} setting "${key}".`,
          data: { value },
        };
      },
    },
    {
      uses: 'android.adbShell',
      label: 'ADB shell',
      description: 'Runs an Android device shell command.',
      requiredPermissions: ['automations:run-adb-shell'],
      schema: shellSchema,
      outputs: [
        {
          key: 'stdout',
          label: 'stdout',
          type: 'string',
          description: 'Shell command standard output.',
        },
        {
          key: 'stderr',
          label: 'stderr',
          type: 'string',
          description: 'Shell command standard error.',
        },
        {
          key: 'exitCode',
          label: 'Exit code',
          type: 'number',
          description: 'Shell command exit code.',
        },
      ],
      execute: async (
        { command, timeoutMs }: z.infer<typeof shellSchema>,
        { app, adb }: AutomationCommandContext,
      ) => {
        const result = await adb.shell(app, command, timeoutMs);
        const stdout = result.stdout.trim();
        const stderr = result.stderr.trim();
        const preview = (value: string) =>
          value.length > 800 ? `${value.slice(0, 800)}...` : value;

        const summaryParts: string[] =
          result.exitCode === 0
            ? [`Shell command exited with ${result.exitCode}.`]
            : [
                `Shell command failed with exit code ${result.exitCode}.`,
                ...(stdout || stderr
                  ? [`${stdout || stderr}`]
                  : ['No command output was returned.']),
              ];
        if (stdout) {
          summaryParts.push(`stdout: ${preview(stdout)}`);
        }
        if (stderr) {
          summaryParts.push(`stderr: ${preview(stderr)}`);
        }

        return {
          summary: summaryParts.join(' '),
          data: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          },
        };
      },
    },
  ] as unknown as AutomationCommandDefinition[];
