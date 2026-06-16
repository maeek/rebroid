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
      uses: 'android.expandNotifications',
      label: 'Expand notifications',
      description:
        'Opens the Android notification shade using the native status bar/viewer control. Prefer this over swipe gestures for notification shade access.',
      aiTool: {
        name: 'android_openNotificationShade',
        label: 'Open notification shade',
        description:
          'Opens the Android notification shade/status shade. Use only when the goal involves notifications or the status shade; this does not open the Settings app or app drawer.',
      },
      requiredPermissions: ['automations:run'],
      schema: emptyInputSchema,
      execute: async (
        _input: Record<string, never>,
        { app, display }: AutomationCommandContext,
      ) => {
        await display.viewerControl(app, 'expand-notifications');
        return { summary: 'Expanded notification shade.' };
      },
    },
    {
      uses: 'android.expandQuickSettings',
      label: 'Expand quick settings',
      description:
        'Opens the Android quick settings panel using the native status bar/viewer control. Use this for quick settings tiles instead of swipeNormalized.',
      aiTool: {
        name: 'android_openQuickControlsPanel',
        label: 'Open quick controls panel',
        description:
          'Opens the Android status-shade quick-controls panel with tiles such as Wi-Fi/Bluetooth and possibly a gear entry point. This is not the Settings app, not the app drawer, and not a search route for installed apps.',
      },
      requiredPermissions: ['automations:run'],
      schema: emptyInputSchema,
      execute: async (
        _input: Record<string, never>,
        { app, display }: AutomationCommandContext,
      ) => {
        await display.viewerControl(app, 'expand-settings');
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
        { app, display }: AutomationCommandContext,
      ) => {
        await display.viewerControl(app, 'collapse-panels');
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
        { app, adb }: AutomationCommandContext,
      ) => {
        await adb.rotateDisplay(app, orientation);
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
  ] as unknown as AutomationCommandDefinition[];
