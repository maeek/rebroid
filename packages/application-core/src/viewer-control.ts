export const viewerCommands = [
  "back",
  "home",
  "recents",
  "power",
  "wake",
  "sleep",
  "volume-up",
  "volume-down",
  "mute",
  "rotate",
  "expand-notifications",
  "expand-settings",
  "collapse-panels",
] as const;

export type ViewerCommand = (typeof viewerCommands)[number];

export const VIEWER_CONTROL_COMMANDS = new Set<ViewerCommand>(viewerCommands);
