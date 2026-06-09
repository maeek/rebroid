import { viewerCommands } from "@rebroid/application-core/viewer-control";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export type DisplaySessionStatus =
  | "created"
  | "active"
  | "released"
  | "expired";

export class DisplayNewDisplayDto {
  @ApiProperty({ example: 1280 })
  width!: number;

  @ApiProperty({ example: 720 })
  height!: number;

  @ApiProperty({ example: 160 })
  dpi!: number;
}

export class CreateDisplaySessionDto {
  @ApiPropertyOptional({
    example: "app_123",
    description: "Caller-owned application identifier for session reuse.",
  })
  appId?: string;

  @ApiProperty({
    example: "redroid-13:5555",
    description: "ADB serial or host:port target reachable from the sidecar.",
  })
  udid!: string;

  @ApiPropertyOptional({
    example: "user_123",
    description: "Caller-owned user identifier for session reuse.",
  })
  ownerUserId?: string;

  @ApiPropertyOptional({
    example: 900,
    description:
      "Session TTL in seconds. Defaults to DISPLAY_SESSION_TTL_SECONDS.",
  })
  ttlSeconds?: number;

  @ApiPropertyOptional({
    example: ["stream", "clipboard", "input", "screenshot"],
    description: "Informational capability labels assigned to the session.",
    type: [String],
  })
  capabilities?: string[];

  @ApiPropertyOptional({
    example: "main",
    description: "Stable caller-visible surface id.",
  })
  surfaceId?: string;

  @ApiPropertyOptional({ enum: ["main", "virtual"], example: "main" })
  surfaceKind?: "main" | "virtual";

  @ApiPropertyOptional({ example: "Main display" })
  displayName?: string;

  @ApiPropertyOptional({ example: 0 })
  displayId?: number;

  @ApiPropertyOptional({
    example: { width: 1280, height: 720, dpi: 160 },
  })
  newDisplay?: DisplayNewDisplayDto;
}

export class CreateDisplaySurfaceDto {
  @ApiPropertyOptional({ example: "Virtual display" })
  name?: string;

  @ApiPropertyOptional({ example: 1280 })
  width?: number;

  @ApiPropertyOptional({ example: 720 })
  height?: number;

  @ApiPropertyOptional({ example: 160 })
  dpi?: number;
}

export class DisplaySurfaceDto {
  @ApiProperty({ example: "main" })
  id!: string;

  @ApiProperty({ example: "7c7270d5-bd2d-4ac2-81f6-1f77be3596b5" })
  sessionId!: string;

  @ApiProperty({ enum: ["main", "virtual"], example: "main" })
  kind!: "main" | "virtual";

  @ApiProperty({ example: "Main display" })
  name!: string;

  @ApiProperty({
    enum: ["created", "active", "released", "expired"],
    example: "created",
  })
  status!: DisplaySessionStatus;

  @ApiProperty({ example: "2026-05-25T20:30:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-05-25T20:30:10.000Z" })
  lastActivityAt!: string;

  @ApiProperty({ example: "/rebroid/display/stream?sessionId=...&token=..." })
  streamPath!: string;

  @ApiProperty({ example: "/viewer/display/?sessionId=...&token=..." })
  viewerPath!: string;

  @ApiProperty({ example: "/rebroid/display/public/sessions/.../webrtc/offer" })
  webrtcOfferPath!: string;

  @ApiPropertyOptional({ example: 0 })
  displayId?: number;

  @ApiPropertyOptional({ type: DisplayNewDisplayDto })
  newDisplay?: DisplayNewDisplayDto;
}

export class DisplaySessionDto {
  @ApiProperty({ example: "7c7270d5-bd2d-4ac2-81f6-1f77be3596b5" })
  id!: string;

  @ApiPropertyOptional({ example: "app_123" })
  appId?: string;

  @ApiProperty({ example: "redroid-13:5555" })
  udid!: string;

  @ApiPropertyOptional({ example: "user_123" })
  ownerUserId?: string;

  @ApiProperty({ example: "main" })
  surfaceId!: string;

  @ApiProperty({ enum: ["main", "virtual"], example: "main" })
  surfaceKind!: "main" | "virtual";

  @ApiProperty({ example: "Main display" })
  displayName!: string;

  @ApiPropertyOptional({ example: 0 })
  displayId?: number;

  @ApiPropertyOptional({ type: DisplayNewDisplayDto })
  newDisplay?: DisplayNewDisplayDto;

  @ApiProperty({
    enum: ["created", "active", "released", "expired"],
    example: "created",
  })
  status!: DisplaySessionStatus;

  @ApiProperty({ example: "2026-05-25T20:30:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-05-25T20:30:10.000Z" })
  lastActivityAt!: string;

  @ApiProperty({ example: "2026-05-25T20:45:10.000Z" })
  expiresAt!: string;

  @ApiProperty({ example: "2026-05-25T21:30:10.000Z" })
  maxExpiresAt!: string;

  @ApiProperty({
    example: ["stream", "clipboard", "input", "screenshot"],
    type: [String],
  })
  capabilities!: string[];

  @ApiProperty({ type: DisplaySurfaceDto })
  surface!: DisplaySurfaceDto;

  @ApiProperty({ type: DisplaySurfaceDto, isArray: true })
  surfaces!: DisplaySurfaceDto[];

  @ApiProperty({ example: "/rebroid/display/stream?sessionId=...&token=..." })
  streamPath!: string;

  @ApiProperty({ example: "/viewer/display/?sessionId=...&token=..." })
  viewerPath!: string;

  @ApiProperty({ example: "/rebroid/display/public/sessions/.../webrtc/offer" })
  webrtcOfferPath!: string;
}

export class DisplaySessionResponseDto {
  @ApiProperty({ type: DisplaySessionDto })
  session!: DisplaySessionDto;
}

export class DisplaySurfaceListResponseDto {
  @ApiProperty({ type: DisplaySurfaceDto, isArray: true })
  items!: DisplaySurfaceDto[];
}

export class DisplaySessionListResponseDto {
  @ApiProperty({ type: DisplaySessionDto, isArray: true })
  items!: DisplaySessionDto[];
}

export class DisplayActionDto {
  @ApiPropertyOptional({ enum: viewerCommands, example: "home" })
  command?: string;
}

export class PublicDisplayActionDto extends DisplayActionDto {
  @ApiPropertyOptional({
    example: "display-session-token",
    type: String,
    nullable: true,
  })
  token?: string | null;
}

export class DisplayWebrtcOfferDto {
  @ApiPropertyOptional({
    example: "display-session-token",
    type: String,
    nullable: true,
  })
  token?: string | null;

  @ApiProperty({ example: "v=0\r\n..." })
  sdp!: string;

  @ApiPropertyOptional({ example: 7000000 })
  bitrate?: number;

  @ApiPropertyOptional({ example: 30 })
  maxFps?: number;

  @ApiPropertyOptional({ example: 1080 })
  maxSize?: number;

  @ApiPropertyOptional({ example: 1 })
  iFrameInterval?: number;

  @ApiPropertyOptional({ example: true, default: true })
  audio?: boolean;
}

export class DisplayWebrtcAnswerDto {
  @ApiProperty({ example: "webrtc" })
  transport!: "webrtc";

  @ApiProperty({ example: "h264" })
  codec!: "h264";

  @ApiProperty({ example: "v=0\r\n..." })
  sdp!: string;

  @ApiProperty({ type: [String], example: [] })
  iceServers!: string[];
}

export class DisplayKeyboardDto {
  @ApiPropertyOptional({
    example: "display-session-token",
    type: String,
    nullable: true,
  })
  token?: string | null;

  @ApiPropertyOptional({ enum: ["keydown", "keyup"], example: "keydown" })
  eventType?: "keydown" | "keyup";

  @ApiPropertyOptional({ example: "Enter" })
  key?: string;

  @ApiPropertyOptional({ example: "Enter" })
  code?: string;

  @ApiPropertyOptional({ example: false })
  repeat?: boolean;

  @ApiPropertyOptional({ example: false })
  altKey?: boolean;

  @ApiPropertyOptional({ example: false })
  ctrlKey?: boolean;

  @ApiPropertyOptional({ example: false })
  metaKey?: boolean;

  @ApiPropertyOptional({ example: false })
  shiftKey?: boolean;
}

export class DisplayTouchDto {
  @ApiPropertyOptional({
    example: "display-session-token",
    type: String,
    nullable: true,
  })
  token?: string | null;

  @ApiPropertyOptional({
    enum: ["tap", "swipe", "pointer"],
    example: "pointer",
  })
  action?: "tap" | "swipe" | "pointer";

  @ApiPropertyOptional({
    enum: ["down", "move", "up", "cancel"],
    example: "move",
  })
  eventType?: "down" | "move" | "up" | "cancel";

  @ApiPropertyOptional({ example: 320 })
  x?: number;

  @ApiPropertyOptional({ example: 640 })
  y?: number;

  @ApiPropertyOptional({ example: 120 })
  x1?: number;

  @ApiPropertyOptional({ example: 800 })
  y1?: number;

  @ApiPropertyOptional({ example: 540 })
  x2?: number;

  @ApiPropertyOptional({ example: 800 })
  y2?: number;

  @ApiPropertyOptional({ example: 1080 })
  videoWidth?: number;

  @ApiPropertyOptional({ example: 1920 })
  videoHeight?: number;

  @ApiPropertyOptional({ example: 250 })
  durationMs?: number;
}

export class DisplayClipboardDto {
  @ApiPropertyOptional({ example: "Text copied from the host." })
  text?: string;
}

export class DisplayClipboardResultDto {
  @ApiProperty({ example: "Text copied from the host." })
  text!: string;

  @ApiProperty({ example: true })
  supported!: boolean;

  @ApiPropertyOptional({ type: DisplaySessionDto })
  session?: DisplaySessionDto;

  @ApiPropertyOptional({ example: "stream-control" })
  transport?: string;
}

export class DisplayCommandResultDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiPropertyOptional({ type: DisplaySessionDto })
  session?: DisplaySessionDto;

  @ApiPropertyOptional({ enum: viewerCommands, example: "home" })
  command?: string;

  @ApiPropertyOptional({ example: true })
  executed?: boolean;

  @ApiPropertyOptional({ example: "stream-control" })
  transport?: string;

  @ApiPropertyOptional({ example: "" })
  stdout?: string;

  @ApiPropertyOptional({ example: "" })
  stderr?: string;

  @ApiPropertyOptional({ example: "Unsupported display action command: foo" })
  message?: string;
}

export class DisplayRecordingDto {
  @ApiProperty({ example: "display-1-lx5s2m" })
  id!: string;

  @ApiProperty({ example: "display-1" })
  sessionId!: string;

  @ApiProperty({ enum: ["recording", "stopped"], example: "recording" })
  status!: "recording" | "stopped";

  @ApiProperty({ example: "2026-05-25T20:30:00.000Z" })
  startedAt!: string;

  @ApiProperty({ type: String, nullable: true })
  stoppedAt!: string | null;

  @ApiProperty({ example: "main-display-2026-05-25T20-30-00-000Z.mp4" })
  fileName!: string;

  @ApiProperty({ example: "video/mp4" })
  mimeType!: string;

  @ApiProperty({ example: 1024000 })
  sizeBytes!: number;

  @ApiProperty({ example: 15_000 })
  durationMs!: number;

  @ApiProperty({ example: 450 })
  sampleCount!: number;

  @ApiProperty({ type: String, nullable: true })
  downloadPath!: string | null;
}

export class DisplayRecordingResponseDto {
  @ApiProperty({ type: DisplayRecordingDto })
  recording!: DisplayRecordingDto;
}

export class DisplayRecordingListResponseDto {
  @ApiProperty({ type: DisplayRecordingDto, isArray: true })
  items!: DisplayRecordingDto[];
}

export class DisplayCapabilitiesDto {
  @ApiProperty({
    example: {
      protocols: ["websocket", "webrtc"],
      adapters: ["scrcpy-server-v4-raw"],
      codecs: ["h264"],
      audioCodecs: ["opus"],
      defaultCodec: "h264",
      players: ["webcodecs", "webrtc"],
    },
  })
  stream!: Record<string, string | string[]>;

  @ApiProperty({
    example: {
      scrcpyVersion: "4.0",
      supportedAndroidVersions: ["13", "14"],
      unsupportedAndroidVersions: ["15", "16"],
      fallbackModes: [
        "audio-disabled",
        "stream-control-disabled",
        "stable-video",
      ],
    },
  })
  compatibility!: Record<string, string | string[]>;

  @ApiProperty({
    example: {
      defaultSurface: "main",
      virtualDisplayLimit: 1,
      virtualDisplayDefault: "1280x720/160",
    },
  })
  surfaces!: Record<string, string | number>;

  @ApiProperty({
    example: {
      container: "mp4",
      videoCodec: "h264",
      audio: "not-recorded",
    },
  })
  recording!: Record<string, string>;

  @ApiProperty({ enum: viewerCommands, isArray: true })
  actions!: string[];

  @ApiProperty({ example: true })
  adbOwnedBySidecar!: boolean;
}

export class DisplayHealthDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: "rebroid-display" })
  service!: string;
}

export class DisplayLogcatDto {
  @ApiProperty({ example: "2026-05-25T20:30:00.000Z" })
  collectedAt!: string;

  @ApiProperty({ example: "05-25 20:30:00.000 ..." })
  output!: string;
}
