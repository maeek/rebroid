import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import {
  emptyInputSchema,
  rotateSchema,
  screenshotSchema,
  viewerCommandSchema,
  waitSchema,
} from './android-automation-command-schemas';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

export const createAndroidDeviceControlAutomationCommands = () =>
  [
    {
      uses: 'android.wait',
      label: 'Wait',
      description: 'Pauses the automation for a fixed duration.',
      requiredPermissions: ['automations:run'],
      schema: waitSchema,
      execute: async (
        { durationMs }: z.infer<typeof waitSchema>,
        { abortSignal }: AutomationCommandContext,
      ) => {
        await delay(durationMs, undefined, { signal: abortSignal });
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
        { app, display, abortSignal }: AutomationCommandContext,
      ) => {
        await display.viewerControl(app, command, abortSignal);
        return { summary: `Sent ${command}.` };
      },
    },
    {
      uses: 'android.expandNotifications',
      label: 'Expand notifications',
      description:
        'Opens the Android notification shade using the native status bar/viewer control. Prefer this over swipe gestures for notification shade access.',
      requiredPermissions: ['automations:run'],
      schema: emptyInputSchema,
      execute: async (
        _input: Record<string, never>,
        { app, display, abortSignal }: AutomationCommandContext,
      ) => {
        await display.viewerControl(app, 'expand-notifications', abortSignal);
        return { summary: 'Expanded notification shade.' };
      },
    },
    {
      uses: 'android.expandQuickSettings',
      label: 'Expand quick settings',
      description:
        'Opens the Android quick settings panel using the native status bar/viewer control. Use this for quick settings tiles instead of swipeNormalized.',
      requiredPermissions: ['automations:run'],
      schema: emptyInputSchema,
      execute: async (
        _input: Record<string, never>,
        { app, display, abortSignal }: AutomationCommandContext,
      ) => {
        await display.viewerControl(app, 'expand-settings', abortSignal);
        return { summary: 'Expanded quick settings.' };
      },
    },
    {
      uses: 'android.collapsePanels',
      label: 'Collapse panels',
      description: 'Closes the Android notification or quick settings panel.',
      requiredPermissions: ['automations:run'],
      schema: emptyInputSchema,
      execute: async (
        _input: Record<string, never>,
        { app, display, abortSignal }: AutomationCommandContext,
      ) => {
        await display.viewerControl(app, 'collapse-panels', abortSignal);
        return { summary: 'Collapsed system panels.' };
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
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        await adb.rotateDisplay(app, orientation, abortSignal);
        return { summary: `Set display orientation to ${orientation}.` };
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
        { app, adb, abortSignal }: AutomationCommandContext,
      ) => {
        const result = await adb.screenshot(app, abortSignal);
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
  ] as unknown as AutomationCommandDefinition[];
