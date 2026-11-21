import type { ScrcpyStreamOptions, ScrcpyTunnelMode } from "./scrcpy.types";

type ScrcpyServerSettings = {
  version: string;
  logLevel: string;
  controlEnabled: boolean;
  videoEncoder?: string;
};

type ScrcpyServerStreamOptions = Pick<
  ScrcpyStreamOptions,
  | "audio"
  | "bitrate"
  | "codec"
  | "displayId"
  | "iFrameInterval"
  | "maxFps"
  | "maxSize"
  | "newDisplay"
>;

export function buildScrcpyServerOptions(
  options: ScrcpyServerStreamOptions,
  scid: string,
  tunnelMode: ScrcpyTunnelMode,
  { version, logLevel, controlEnabled, videoEncoder }: ScrcpyServerSettings,
): string[] {
  const serverOptions = [
    version,
    `scid=${scid}`,
    `log_level=${logLevel}`,
    "video=true",
    `audio=${options.audio ? "true" : "false"}`,
    "audio_codec=opus",
    `control=${controlEnabled ? "true" : "false"}`,
    "clipboard_autosync=true",
    "cleanup=false",
    "keep_active=true",
    "power_on=true",
    "send_device_meta=false",
    "send_frame_meta=true",
    `send_dummy_byte=${tunnelMode === "reverse" ? "false" : "true"}`,
    "send_stream_meta=true",
    `max_size=${options.maxSize}`,
    `video_bit_rate=${options.bitrate}`,
    `max_fps=${options.maxFps}`,
    `video_codec=${options.codec}`,
  ];
  if (videoEncoder) {
    serverOptions.push(`video_encoder=${videoEncoder}`);
  }

  if (options.newDisplay) {
    serverOptions.push(
      `new_display=${options.newDisplay.width}x${options.newDisplay.height}/${options.newDisplay.dpi}`,
      "vd_destroy_content=false",
    );
  } else if (options.displayId !== undefined) {
    serverOptions.push(`display_id=${options.displayId}`);
  }

  if (tunnelMode !== "reverse") {
    serverOptions.push("tunnel_forward=true");
  }

  if (options.iFrameInterval && options.iFrameInterval > 0) {
    serverOptions.push(
      `video_codec_options=i-frame-interval:int=${options.iFrameInterval},max-bframes:int=0`,
    );
  }

  return serverOptions;
}
