import { Injectable } from '@nestjs/common';
import { createAndroidDeviceAutomationCommands } from './android-device-automation-commands';
import { createAndroidFileAutomationCommands } from './android-file-automation-commands';
import { createAndroidInputAutomationCommands } from './android-input-automation-commands';
import { AutomationCommandDefinition } from './automation-command.types';

const androidCommandOrder = [
  'android.wait',
  'android.viewerCommand',
  'android.expandNotifications',
  'android.expandQuickSettings',
  'android.collapsePanels',
  'android.rotateDisplay',
  'android.tap',
  'android.tapNormalized',
  'android.swipe',
  'android.swipeNormalized',
  'android.inputText',
  'android.key',
  'android.setClipboard',
  'android.getClipboard',
  'android.screenshot',
  'android.listPackages',
  'android.openSystemSettings',
  'android.launchPackage',
  'android.waitForText',
  'android.tapText',
  'android.getSetting',
  'android.adbShell',
  'android.pushFile',
  'android.pullFile',
  'android.deleteFile',
  'android.fileExists',
  'android.listFiles',
] as const;

@Injectable()
export class AndroidAutomationCommandsService {
  list(): AutomationCommandDefinition[] {
    const commands = [
      ...createAndroidDeviceAutomationCommands(),
      ...createAndroidInputAutomationCommands(),
      ...createAndroidFileAutomationCommands(),
    ];
    const commandsByUse = new Map(
      commands.map((command) => [command.uses, command]),
    );
    return androidCommandOrder.map((uses) => {
      const command = commandsByUse.get(uses);
      if (!command) {
        throw new Error(`Missing Android automation command "${uses}".`);
      }
      return command;
    });
  }
}
