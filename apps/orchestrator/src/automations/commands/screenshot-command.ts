import { screenshotSchema } from './android-automation-command-schemas';
import type { AutomationCommandDefinition } from './automation-command.types';

export const screenshotCommand = (
  summary: string,
): Pick<AutomationCommandDefinition, 'schema' | 'outputs' | 'execute'> => ({
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
  execute: async (_input, { app, adb, abortSignal }) => {
    const result = await adb.screenshot(app, abortSignal);
    return {
      summary,
      data: {
        mimeType: result.mimeType,
        capturedAt: result.capturedAt,
        dataUrl: result.dataUrl,
      },
    };
  },
});
