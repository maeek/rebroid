import type { ApplicationViewerControlCommand } from '../dto/application-viewer-control.dto';

export const viewerControlShellCommand = (
  command: ApplicationViewerControlCommand,
) => {
  const keyEvents: Partial<Record<ApplicationViewerControlCommand, string>> = {
    back: 'BACK',
    home: 'HOME',
    recents: 'APP_SWITCH',
    wake: 'WAKEUP',
    power: 'POWER',
    'volume-up': 'VOLUME_UP',
    'volume-down': 'VOLUME_DOWN',
    mute: 'VOLUME_MUTE',
  };
  const keyEvent = keyEvents[command];

  if (keyEvent) {
    return `input keyevent ${keyEvent}`;
  }

  if (command === 'expand-notifications') {
    return 'cmd statusbar expand-notifications 2>/dev/null || service call statusbar 1 >/dev/null 2>&1 || true';
  }

  if (command === 'expand-settings') {
    return 'cmd statusbar expand-settings 2>/dev/null || true';
  }

  if (command === 'collapse-panels') {
    return 'cmd statusbar collapse 2>/dev/null || service call statusbar 2 >/dev/null 2>&1 || true';
  }

  return [
    'current="$(cmd window get-user-rotation 2>/dev/null | grep -Eo "[0-3]" | tail -n 1)"',
    'if [ -z "$current" ]; then current="$(settings get system user_rotation 2>/dev/null || echo 0)"; fi',
    'case "$current" in 0) next=1;; 1) next=0;; 2) next=3;; 3) next=0;; *) next=1;; esac',
    'cmd window set-user-rotation lock "$next" 2>/dev/null || { settings put system accelerometer_rotation 0 && settings put system user_rotation "$next"; }',
  ].join('; ');
};
