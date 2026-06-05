import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

const textSchema = z.object({
  text: z.string().min(1).max(500),
});

const fileSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((value) => value.startsWith('/'), {
      message: 'Path must be absolute.',
    }),
});

@Injectable()
export class GenericAutomationCommandsService {
  list(): AutomationCommandDefinition[] {
    const commands = [
      {
        uses: 'assert.textExists',
        label: 'Assert text exists',
        description: 'Fails unless text exists in the current UI hierarchy.',
        requiredPermissions: ['automations:run'],
        schema: textSchema,
        execute: async (
          { text }: z.infer<typeof textSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const dump = await adb.dumpUi(app);
          if (!dump.xml.includes(text)) {
            throw new Error(`Text "${text}" was not found.`);
          }
          return { summary: `Text "${text}" exists.` };
        },
      },
      {
        uses: 'assert.textMissing',
        label: 'Assert text missing',
        description: 'Fails when text exists in the current UI hierarchy.',
        requiredPermissions: ['automations:run'],
        schema: textSchema,
        execute: async (
          { text }: z.infer<typeof textSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          const dump = await adb.dumpUi(app);
          if (dump.xml.includes(text)) {
            throw new Error(`Text "${text}" was found.`);
          }
          return { summary: `Text "${text}" is missing.` };
        },
      },
      {
        uses: 'assert.fileExists',
        label: 'Assert file exists',
        description: 'Fails unless a device file exists.',
        requiredPermissions: ['automations:run'],
        schema: fileSchema,
        execute: async (
          { path }: z.infer<typeof fileSchema>,
          { app, adb }: AutomationCommandContext,
        ) => {
          if (!(await adb.fileExists(app, path))) {
            throw new Error(`File "${path}" was not found.`);
          }
          return { summary: `File "${path}" exists.` };
        },
      },
      {
        uses: 'flow.stop',
        label: 'Stop',
        description: 'Stops the automation successfully at this step.',
        requiredPermissions: ['automations:run'],
        schema: z.object({ reason: z.string().max(500).optional() }),
        outputs: [
          {
            key: 'stop',
            label: 'Stopped',
            type: 'boolean',
            description: 'Whether this step requested a successful stop.',
          },
        ],
        execute: async ({ reason }: { reason?: string }) => {
          return {
            summary: reason ? `Stopped: ${reason}` : 'Stopped automation.',
            data: { stop: true },
          };
        },
      },
      {
        uses: 'flow.fail',
        label: 'Fail',
        description: 'Fails the automation intentionally.',
        requiredPermissions: ['automations:run'],
        schema: z.object({ reason: z.string().min(1).max(500) }),
        execute: async ({ reason }: { reason: string }) => {
          throw new Error(reason);
        },
      },
      {
        uses: 'debug.log',
        label: 'Debug log',
        description: 'Records a message in the run step results.',
        requiredPermissions: ['automations:run'],
        schema: z.object({ message: z.string().max(2_000) }),
        execute: async ({ message }: { message: string }) => ({
          summary: message,
        }),
      },
      {
        uses: 'artifact.saveScreenshot',
        label: 'Save screenshot artifact',
        description: 'Captures a screenshot into the run step output.',
        requiredPermissions: ['automations:run'],
        schema: z.object({}),
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
            summary: 'Screenshot artifact saved.',
            data: {
              mimeType: result.mimeType,
              capturedAt: result.capturedAt,
              dataUrl: result.dataUrl,
            },
          };
        },
      },
    ];
    return commands as unknown as AutomationCommandDefinition[];
  }
}
