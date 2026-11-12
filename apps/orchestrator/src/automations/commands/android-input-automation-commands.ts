import { normalizedPointToPixels } from '../vision/vision-geometry';
import { z } from 'zod';
import { readAiScreenshotMetadata } from '../ai/automation-ai-screenshot.utils';
import {
  keySchema,
  swipeNormalizedSchema,
  swipeSchema,
  tapNormalizedSchema,
  tapSchema,
  textSchema,
} from './android-automation-command-schemas';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

export const createAndroidInputAutomationCommands = () =>
  [
    {
      uses: 'android.tap',
      label: 'Tap',
      description: 'Taps absolute display coordinates.',
      requiredPermissions: ['automations:run'],
      schema: tapSchema,
      execute: async (
        input: z.infer<typeof tapSchema>,
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        await adb.tap(app, input.x, input.y, abortSignal);
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
        context: AutomationCommandContext,
      ) => {
        const { app, adb, abortSignal } = context;
        const image = await readDisplaySize(context);
        const point = normalizedPointToPixels(input, image);
        await adb.tap(app, point.x, point.y, abortSignal);
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
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        await adb.swipe(app, input, abortSignal);
        return { summary: 'Swipe completed.' };
      },
    },
    {
      uses: 'android.swipeNormalized',
      label: 'Swipe normalized',
      description:
        'Swipes between start and end points with normalized screen coordinates from 0 to 1.',
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
        context: AutomationCommandContext,
      ) => {
        const { app, adb, abortSignal } = context;
        const image = await readDisplaySize(context);
        const start = normalizedPointToPixels(input.start, image);
        const end = normalizedPointToPixels(input.end, image);
        await adb.swipe(
          app,
          {
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            durationMs: input.durationMs,
          },
          abortSignal,
        );
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
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        await adb.inputText(app, text, abortSignal);
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
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        await adb.key(app, key, abortSignal);
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
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        const result = await adb.setClipboard(app, text, abortSignal);
        if (result?.supported !== true) {
          throw new Error('Android clipboard write is unavailable.');
        }
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
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        const result = await adb.getClipboard(app, abortSignal);
        return {
          summary: result.supported
            ? 'Clipboard read.'
            : 'Clipboard read is unsupported.',
          data: { text: result.text, supported: result.supported },
        };
      },
    },
  ] as unknown as AutomationCommandDefinition[];

const readDisplaySize = async ({
  app,
  adb,
  abortSignal,
}: AutomationCommandContext) => {
  const { width, height } = await readAiScreenshotMetadata(
    await adb.screenshot(app, abortSignal),
  );
  if (!width || !height) {
    throw new Error(
      'Could not determine Android display dimensions from the screenshot.',
    );
  }
  return { width, height };
};
