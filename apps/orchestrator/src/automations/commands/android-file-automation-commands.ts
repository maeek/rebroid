import { z } from 'zod';
import {
  filePushSchema,
  fileSchema,
} from './android-automation-command-schemas';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

export const createAndroidFileAutomationCommands = () =>
  [
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
  ] as unknown as AutomationCommandDefinition[];
