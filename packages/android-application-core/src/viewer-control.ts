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

export const viewerTransport = {
  WebSocket: "websocket",
  WebRTC: "webrtc",
} as const;

export const viewerTransports = [
  viewerTransport.WebRTC,
  viewerTransport.WebSocket,
] as const;

export type ViewerTransport =
  (typeof viewerTransport)[keyof typeof viewerTransport];
