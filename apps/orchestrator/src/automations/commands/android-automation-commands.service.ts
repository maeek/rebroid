import { Injectable } from '@nestjs/common';
import { normalizedPointToPixels } from '@rebroid/vision-core/geometry';
import { z } from 'zod';
import { applicationViewerControlCommands } from '../../android-apps/viewer/dto/application-viewer-control.dto';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';
import { readAiScreenshotMetadata } from '../ai/automation-ai-screenshot.utils';

const timeoutSchema = z
  .number()
  .int()
  .min(100)
  .max(120_000)
  .optional()
  .default(10_000);

const viewerCommandSchema = z.object({
  command: z.enum(applicationViewerControlCommands),
});

const rotateSchema = z.object({
  orientation: z.enum([
    'portrait',
    'landscape',
    'reverse-portrait',
    'reverse-landscape',
  ]),
});

const tapSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const tapNormalizedSchema = normalizedPointSchema;

const swipeSchema = z.object({
  x1: z.number().int().min(0),
  y1: z.number().int().min(0),
  x2: z.number().int().min(0),
  y2: z.number().int().min(0),
  durationMs: z.number().int().min(50).max(5_000).optional().default(300),
});

const swipeNormalizedSchema = z.object({
  start: normalizedPointSchema,
  end: normalizedPointSchema,
  durationMs: z.number().int().min(50).max(5_000).optional().default(300),
});

const textSchema = z.object({
  text: z.string().max(20_000),
});

const keySchema = z.object({
  key: z.string().min(1).max(80),
});

const screenshotSchema = z.object({});

const packageNameSchema = z.object({
  packageName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/, {
      message: 'Package name must be a valid Android package identifier.',
    }),
  timeoutMs: timeoutSchema,
});

const listPackagesSchema = z.object({
  query: z.string().trim().max(120).optional().default(''),
  includeSystem: z.boolean().optional().default(false),
  maxResults: z.number().int().min(1).max(200).optional().default(50),
  timeoutMs: timeoutSchema,
});

const waitSchema = z.object({
  durationMs: z.number().int().min(1).max(120_000),
});

const textWaitSchema = z.object({
  text: z.string().min(1).max(500),
  timeoutMs: timeoutSchema,
  intervalMs: z.number().int().min(250).max(10_000).optional().default(1_000),
});

const shellSchema = z.object({
  command: z.string().min(1).max(4_000),
  timeoutMs: z.number().int().min(100).max(120_000).optional().default(15_000),
});

const androidSettingSchema = z.object({
  namespace: z.enum(['system', 'secure', 'global']),
  key: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9_.:-]+$/, {
      message: 'Setting key contains unsupported characters.',
    }),
  timeoutMs: timeoutSchema,
});

const remotePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith('/'), {
    message: 'Path must be absolute.',
  });

const fileSchema = z.object({
  path: remotePathSchema,
});

const filePushSchema = z.object({
  path: remotePathSchema,
  contentBase64: z.string().min(1).max(8_000_000),
});

@Injectable()
export class AndroidAutomationCommandsService {
  list(): AutomationCommandDefinition[] {
    const commands = [
      {
        uses: 'android.wait',
        label: 'Wait',
        description: 'Pauses the automation for a fixed duration.',
        requiredPermissions: ['automations:run'],
        schema: waitSchema,
        execute: async ({ durationMs }: z.infer<typeof waitSchema>) => {
          await new Promise((resolve) => setTimeout(resolve, durationMs));
          return { summary: `Waited ${durationMs}ms.` };
        },
      },
      {
        uses: 'android.viewerCommand',
        label: 'Viewer command',
        description: 'Sends a supported viewer control command.',
        requiredPermissions: ['automations:run'],
        schema: viewerCommandSchema,
        execute: async (
          { command }: z.infer<typeof viewerCommandSchema>,
          { app, display }: AutomationCommandContext,
        ) => {
          await display.viewerControl(app, command);
          return { summary: `Sent ${command}.` };
        },
      },
      {
        uses: 'android.rotateDisplay',
        label: 'Rotate display',
        description: 'Sets the Android display orientation.',
        requiredPermissions: ['automations:run'],
        schema: rotateSchema,
        execute: async (
          { orientation }: z.infer<typeof rotateSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.rotateDisplay(app, orientation);
          return { summary: `Set display orientation to ${orientation}.` };
        },
      },
      {
        uses: 'android.tap',
        label: 'Tap',
        description: 'Taps absolute display coordinates.',
        requiredPermissions: ['automations:run'],
        schema: tapSchema,
        execute: async (
          input: z.infer<typeof tapSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.tap(app, input.x, input.y);
          return { summary: `Tapped ${input.x}, ${input.y}.` };
        },
      },
      {
        uses: 'android.tapNormalized',
        label: 'Tap normalized',
        description: 'Taps normalized screen coordinates from 0 to 1.',
        requiredPermissions: ['automations:run'],
        schema: tapNormalizedSchema,
        outputs: [
          {
            key: 'x',
            label: 'X coordinate',
            type: 'number',
            description: 'Resolved pixel X coordinate.',
          },
          {
            key: 'y',
            label: 'Y coordinate',
            type: 'number',
            description: 'Resolved pixel Y coordinate.',
          },
        ],
        editor: {
          category: 'Touch',
          iconKey: 'tap',
          inputDefaults: { x: 0.5, y: 0.5 },
          yamlSnippetFields: ['x', 'y'],
        },
        execute: async (
          input: z.infer<typeof tapNormalizedSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const screenshot = await readAiScreenshotMetadata(
            await adb.screenshot(app),
          );
          const point = normalizedPointToPixels(input, {
            width: screenshot.width ?? 1,
            height: screenshot.height ?? 1,
          });
          await adb.tap(app, point.x, point.y);
          return {
            summary: `Tapped normalized ${input.x}, ${input.y}.`,
            data: { x: point.x, y: point.y },
          };
        },
      },
      {
        uses: 'android.swipe',
        label: 'Swipe',
        description: 'Swipes between absolute display coordinates.',
        requiredPermissions: ['automations:run'],
        schema: swipeSchema,
        execute: async (
          input: z.infer<typeof swipeSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.swipe(app, input);
          return { summary: 'Swipe completed.' };
        },
      },
      {
        uses: 'android.swipeNormalized',
        label: 'Swipe normalized',
        description:
          'Swipes between normalized screen coordinates from 0 to 1.',
        requiredPermissions: ['automations:run'],
        schema: swipeNormalizedSchema,
        outputs: [
          {
            key: 'x1',
            label: 'Start X coordinate',
            type: 'number',
            description: 'Resolved start pixel X coordinate.',
          },
          {
            key: 'y1',
            label: 'Start Y coordinate',
            type: 'number',
            description: 'Resolved start pixel Y coordinate.',
          },
          {
            key: 'x2',
            label: 'End X coordinate',
            type: 'number',
            description: 'Resolved end pixel X coordinate.',
          },
          {
            key: 'y2',
            label: 'End Y coordinate',
            type: 'number',
            description: 'Resolved end pixel Y coordinate.',
          },
        ],
        editor: {
          category: 'Touch',
          iconKey: 'swipe',
          inputDefaults: {
            start: { x: 0.5, y: 0.8 },
            end: { x: 0.5, y: 0.2 },
            durationMs: 300,
          },
          yamlSnippetFields: ['start', 'end', 'durationMs'],
        },
        execute: async (
          input: z.infer<typeof swipeNormalizedSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const screenshot = await readAiScreenshotMetadata(
            await adb.screenshot(app),
          );
          const image = {
            width: screenshot.width ?? 1,
            height: screenshot.height ?? 1,
          };
          const start = normalizedPointToPixels(input.start, image);
          const end = normalizedPointToPixels(input.end, image);
          await adb.swipe(app, {
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            durationMs: input.durationMs,
          });
          return {
            summary: 'Normalized swipe completed.',
            data: {
              x1: start.x,
              y1: start.y,
              x2: end.x,
              y2: end.y,
            },
          };
        },
      },
      {
        uses: 'android.inputText',
        label: 'Input text',
        description: 'Types text through Android input.',
        requiredPermissions: ['automations:run'],
        schema: textSchema,
        execute: async (
          { text }: z.infer<typeof textSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.inputText(app, text);
          return { summary: `Input ${text.length} character(s).` };
        },
      },
      {
        uses: 'android.key',
        label: 'Key event',
        description: 'Sends an Android key event.',
        requiredPermissions: ['automations:run'],
        schema: keySchema,
        execute: async (
          { key }: z.infer<typeof keySchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.key(app, key);
          return { summary: `Sent key ${key}.` };
        },
      },
      {
        uses: 'android.setClipboard',
        label: 'Set clipboard',
        description: 'Writes Android clipboard text.',
        requiredPermissions: ['automations:run'],
        schema: textSchema,
        execute: async (
          { text }: z.infer<typeof textSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.setClipboard(app, text);
          return { summary: `Set clipboard to ${text.length} character(s).` };
        },
      },
      {
        uses: 'android.getClipboard',
        label: 'Get clipboard',
        description: 'Reads Android clipboard text.',
        requiredPermissions: ['automations:run'],
        schema: z.object({}),
        outputs: [
          {
            key: 'text',
            label: 'Text',
            type: 'string',
            description: 'Clipboard text returned by Android.',
          },
          {
            key: 'supported',
            label: 'Supported',
            type: 'boolean',
            description: 'Whether clipboard reads are supported.',
          },
        ],
        execute: async (
          _input: Record<string, never>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const result = await adb.getClipboard(app);
          return {
            summary: result.supported
              ? 'Clipboard read.'
              : 'Clipboard read is unsupported.',
            data: { text: result.text, supported: result.supported },
          };
        },
      },
      {
        uses: 'android.screenshot',
        label: 'Screenshot',
        description: 'Captures a PNG screenshot artifact.',
        requiredPermissions: ['automations:run'],
        schema: screenshotSchema,
        outputs: [
          {
            key: 'mimeType',
            label: 'MIME type',
            type: 'string',
            description: 'Screenshot media type.',
            example: 'image/png',
          },
          {
            key: 'capturedAt',
            label: 'Captured at',
            type: 'string',
            description: 'Timestamp when the screenshot was captured.',
          },
          {
            key: 'dataUrl',
            label: 'Image data',
            type: 'string',
            description: 'Screenshot encoded as a data URL.',
          },
        ],
        execute: async (
          _input: Record<string, never>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const result = await adb.screenshot(app);
          return {
            summary: 'Screenshot captured.',
            data: {
              mimeType: result.mimeType,
              capturedAt: result.capturedAt,
              dataUrl: result.dataUrl,
            },
          };
        },
      },
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
            description:
              'Total matching packages before maxResults truncation.',
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
            description:
              'Failure reason when the package could not be launched.',
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
          throw new Error(
            `Text "${text}" was not found within ${timeoutMs}ms.`,
          );
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
          throw new Error(
            `Text "${text}" was not found within ${timeoutMs}ms.`,
          );
        },
      },
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
          return {
            summary: `Shell command exited with ${result.exitCode}.`,
            data: {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
            },
          };
        },
      },
      {
        uses: 'android.pushFile',
        label: 'Push file',
        description: 'Writes base64 content to a device file.',
        requiredPermissions: ['automations:run'],
        schema: filePushSchema,
        execute: async (
          { path, contentBase64 }: z.infer<typeof filePushSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.pushFile(app, path, contentBase64);
          return { summary: `Pushed file to ${path}.` };
        },
      },
      {
        uses: 'android.pullFile',
        label: 'Pull file',
        description: 'Reads a device file as base64 content.',
        requiredPermissions: ['automations:run'],
        schema: fileSchema,
        outputs: [
          {
            key: 'contentBase64',
            label: 'File content',
            type: 'string',
            description: 'Pulled file content encoded as base64.',
          },
          {
            key: 'mimeType',
            label: 'MIME type',
            type: 'string',
            description: 'Detected file media type.',
          },
          {
            key: 'size',
            label: 'Size',
            type: 'number',
            description: 'Pulled file size in bytes.',
          },
        ],
        execute: async (
          { path }: z.infer<typeof fileSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const result = await adb.pullFile(app, path);
          return { summary: `Pulled file ${path}.`, data: result };
        },
      },
      {
        uses: 'android.deleteFile',
        label: 'Delete file',
        description: 'Deletes a device file.',
        requiredPermissions: ['automations:run'],
        schema: fileSchema,
        execute: async (
          { path }: z.infer<typeof fileSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          await adb.deleteFile(app, path);
          return { summary: `Deleted ${path}.` };
        },
      },
      {
        uses: 'android.fileExists',
        label: 'File exists',
        description: 'Checks whether a device file exists.',
        requiredPermissions: ['automations:run'],
        schema: fileSchema,
        outputs: [
          {
            key: 'exists',
            label: 'Exists',
            type: 'boolean',
            description: 'Whether the file exists.',
          },
        ],
        execute: async (
          { path }: z.infer<typeof fileSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const exists = await adb.fileExists(app, path);
          return {
            summary: exists ? `${path} exists.` : `${path} does not exist.`,
            data: { exists },
          };
        },
      },
      {
        uses: 'android.listFiles',
        label: 'List files',
        description: 'Lists device files under a directory.',
        requiredPermissions: ['automations:run'],
        schema: fileSchema,
        outputs: [
          {
            key: 'files',
            label: 'Files',
            type: 'array',
            description: 'Files listed under the requested directory.',
          },
        ],
        execute: async (
          { path }: z.infer<typeof fileSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const files = await adb.listFiles(app, path);
          return {
            summary: `Listed ${files.length} file(s).`,
            data: { files },
          };
        },
      },
    ];
    return commands as unknown as AutomationCommandDefinition[];
  }
}
