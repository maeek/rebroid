import { Injectable } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const optionalInteger = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum).optional();

const environmentSchema = z.object({
  PORT: optionalInteger(1, 65_535),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DISPLAY_SESSION_TTL_SECONDS: optionalInteger(1, 86_400),
  DISPLAY_SESSION_MAX_LIFETIME_SECONDS: optionalInteger(1, 604_800),
  DISPLAY_SESSION_MAX_ACTIVE: optionalInteger(1, 10_000),
  DISPLAY_WEBRTC_UDP_PORT_RANGE: z
    .string()
    .regex(
      /^\d{1,5}-\d{1,5}$/,
      "Expected a UDP port range such as 40000-40100.",
    )
    .refine((value) => {
      const [first, last] = value.split("-").map(Number);
      return first >= 1 && first <= last && last <= 65_535;
    }, "UDP port range must be ordered and contain valid ports.")
    .optional(),
  DISPLAY_WEBRTC_ICE_HOST: z.string().trim().optional(),
  DISPLAY_WEBRTC_STUN_URLS: z.string().optional(),
  DISPLAY_WEBRTC_BRIDGE_PATH: z.string().trim().min(1).optional(),
  DISPLAY_SIDECAR_SHARED_SECRET: z.string().optional(),
  DISPLAY_SIDECAR_SHARED_SECRET_FILE: z.string().trim().min(1).optional(),
  DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API: z
    .enum(["true", "false"])
    .optional(),
  ENABLE_API_DOCS: z.enum(["true", "false"]).optional(),
  ADB_PATH: z.string().trim().min(1).optional(),
  ADB_TEXT_OUTPUT_MAX_BYTES: optionalInteger(1_024, 64 * 1024 * 1024),
  ADB_BINARY_OUTPUT_MAX_BYTES: optionalInteger(1_024, 512 * 1024 * 1024),
  SCRCPY_TUNNEL_MODE: z.enum(["direct", "forward", "reverse"]).optional(),
  SCRCPY_SERVER_LOG_LEVEL: z
    .enum(["verbose", "debug", "info", "warn", "error"])
    .optional(),
  SCRCPY_CONTROL_CHANNEL: z.enum(["true", "false"]).optional(),
  SCRCPY_LOGCAT_ON_SERVER_EXIT: z.enum(["true", "false"]).optional(),
  SCRCPY_SERVER_LAUNCH_MODE: z.enum(["shell", "detached"]).optional(),
  SCRCPY_STABLE_BITRATE: optionalInteger(100_000, 100_000_000),
  SCRCPY_STABLE_MAX_FPS: optionalInteger(1, 240),
  SCRCPY_STABLE_MAX_SIZE: optionalInteger(1, 8_192),
  SCRCPY_STABLE_I_FRAME_INTERVAL: optionalInteger(1, 60),
  SCRCPY_VERSION: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(?:\.\d+)?$/)
    .optional(),
  SCRCPY_SERVER_PATH: z.string().trim().min(1).optional(),
});

export const parseSidecarEnvironment = (
  input: Record<string, string | undefined>,
) => environmentSchema.parse(input);

const environment = parseSidecarEnvironment(process.env);

@Injectable()
export class SidecarConfigService {
  readonly port = environment.PORT ?? 8000;
  readonly sessionTtlSeconds = environment.DISPLAY_SESSION_TTL_SECONDS ?? 900;
  readonly sessionMaxLifetimeSeconds =
    environment.DISPLAY_SESSION_MAX_LIFETIME_SECONDS ?? 3600;
  readonly sessionMaxActive = environment.DISPLAY_SESSION_MAX_ACTIVE ?? 64;
  readonly scrcpyVersion = environment.SCRCPY_VERSION || "4.0";
  readonly scrcpyServerPath =
    environment.SCRCPY_SERVER_PATH ||
    "/opt/rebroid-display-sidecar/scrcpy-server";
  readonly webrtcBridgePath =
    environment.DISPLAY_WEBRTC_BRIDGE_PATH ||
    "/opt/rebroid-display-sidecar/rebroid-webrtc-bridge";
  readonly webrtcUdpPortRange =
    environment.DISPLAY_WEBRTC_UDP_PORT_RANGE || "40000-40100";
  readonly webrtcIceHostOverride = environment.DISPLAY_WEBRTC_ICE_HOST || "";
  readonly webrtcStunUrls = (environment.DISPLAY_WEBRTC_STUN_URLS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  readonly sharedSecret = this.readSecret();
  readonly allowUnauthenticatedInternalApi =
    environment.DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API === "true";
  readonly enableApiDocs =
    (environment.NODE_ENV ?? "development") !== "production" ||
    environment.ENABLE_API_DOCS === "true";
  readonly adbPath = environment.ADB_PATH || "adb";
  readonly adbTextOutputMaxBytes =
    environment.ADB_TEXT_OUTPUT_MAX_BYTES ?? 2 * 1024 * 1024;
  readonly adbBinaryOutputMaxBytes =
    environment.ADB_BINARY_OUTPUT_MAX_BYTES ?? 64 * 1024 * 1024;
  readonly scrcpyTunnelMode = environment.SCRCPY_TUNNEL_MODE;
  readonly scrcpyServerLogLevel =
    environment.SCRCPY_SERVER_LOG_LEVEL ?? "debug";
  readonly scrcpyControlChannel =
    environment.SCRCPY_CONTROL_CHANNEL !== "false";
  readonly scrcpyLogcatOnServerExit =
    environment.SCRCPY_LOGCAT_ON_SERVER_EXIT !== "false";
  readonly scrcpyServerLaunchMode = environment.SCRCPY_SERVER_LAUNCH_MODE;
  readonly scrcpyStableOptions = Object.freeze({
    bitrate: environment.SCRCPY_STABLE_BITRATE ?? 3_000_000,
    maxFps: environment.SCRCPY_STABLE_MAX_FPS ?? 24,
    maxSize: environment.SCRCPY_STABLE_MAX_SIZE ?? 720,
    iFrameInterval: environment.SCRCPY_STABLE_I_FRAME_INTERVAL ?? 2,
  });

  get hasSharedSecret() {
    return this.sharedSecret.length > 0;
  }

  private readSecret() {
    const inline = environment.DISPLAY_SIDECAR_SHARED_SECRET?.trim();
    if (inline) {
      return inline;
    }

    const explicitFilePath = environment.DISPLAY_SIDECAR_SHARED_SECRET_FILE;
    const filePath = [
      explicitFilePath,
      "/app/secrets/display-sidecar-secret",
      "/data/secrets/display-sidecar-secret",
    ].find((candidate) => candidate && existsSync(candidate));

    if (filePath) {
      return readFileSync(filePath, "utf8").trim();
    }

    return "";
  }
}
