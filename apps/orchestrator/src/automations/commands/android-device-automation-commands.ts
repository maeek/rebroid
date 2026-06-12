import { createAndroidDeviceControlAutomationCommands } from './android-device-control-automation-commands';
import { createAndroidDevicePackageTextAutomationCommands } from './android-device-package-text-automation-commands';
import { createAndroidDeviceShellAutomationCommands } from './android-device-shell-automation-commands';

export const createAndroidDeviceAutomationCommands = () => [
  ...createAndroidDeviceControlAutomationCommands(),
  ...createAndroidDevicePackageTextAutomationCommands(),
  ...createAndroidDeviceShellAutomationCommands(),
];
