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
      aiTool: {
        label: 'Run bounded Android shell command',
        description:
          'Runs a bounded adb shell command only when no typed tool covers the action. Prefer typed tools for package listing, launching, taps, swipes, text lookup, and settings navigation.',
      },
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
        const helpOutput = looksLikeShellHelp(stdout || stderr);
        const preview = (value: string) =>
          value.length > 800 ? `${value.slice(0, 800)}...` : value;

        const summaryParts: string[] =
          result.exitCode === 0
            ? [`Shell command exited with ${result.exitCode}.`]
            : helpOutput
              ? [
                  `Shell command failed with exit code ${result.exitCode}: Android returned command help text.`,
                  'Revise the command syntax or use a typed tool instead of repeating it.',
                ]
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
            ...(result.exitCode !== 0
              ? {
                  failed: true,
                  failureCategory: helpOutput ? 'syntax_error' : 'failed',
                  recoveryHint: helpOutput
                    ? 'Use a typed tool when available, or correct the shell command syntax before retrying.'
                    : 'Use the latest observation and choose a different confirmed route before retrying.',
                }
              : {}),
          },
        };
      },
    },
  ] as unknown as AutomationCommandDefinition[];

const looksLikeShellHelp = (text: string) => {
  const normalized = text.toLowerCase();
  return (
    /\busage:\s/.test(normalized) ||
    /\bcommands:\s/.test(normalized) ||
    normalized.includes('print this help text') ||
    normalized.includes('no service specified; use -l to list')
  );
};
