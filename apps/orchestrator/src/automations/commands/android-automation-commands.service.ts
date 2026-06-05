import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { applicationViewerControlCommands } from '../../android-apps/viewer/dto/application-viewer-control.dto';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

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

const swipeSchema = z.object({
  x1: z.number().int().min(0),
  y1: z.number().int().min(0),
  x2: z.number().int().min(0),
  y2: z.number().int().min(0),
  durationMs: z.number().int().min(50).max(5_000).optional().default(300),
});

const textSchema = z.object({
  text: z.string().max(20_000),
});

const keySchema = z.object({
  key: z.string().min(1).max(80),
});

const screenshotSchema = z.object({});

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
        uses: 'android.adbShell',
        label: 'ADB shell',
        description: 'Runs an Android device shell command.',
        requiredPermissions: ['automations:run-adb-shell'],
        schema: shellSchema,
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
