import { Injectable } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const optionalInteger = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum).optional();

const environment = z
  .object({
    PORT: optionalInteger(1, 65_535),
    DISPLAY_SESSION_TTL_SECONDS: optionalInteger(1, 86_400),
    DISPLAY_SESSION_MAX_LIFETIME_SECONDS: optionalInteger(1, 604_800),
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
    DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API: z
      .enum(["true", "false"])
      .optional(),
    ENABLE_API_DOCS: z.enum(["true", "false"]).optional(),
  })
  .parse(process.env);

@Injectable()
export class SidecarConfigService {
  readonly port = environment.PORT ?? 8000;
  readonly sessionTtlSeconds = environment.DISPLAY_SESSION_TTL_SECONDS ?? 900;
  readonly sessionMaxLifetimeSeconds =
    environment.DISPLAY_SESSION_MAX_LIFETIME_SECONDS ?? 3600;
  readonly scrcpyVersion = process.env.SCRCPY_VERSION?.trim() || "4.0";
  readonly scrcpyServerPath =
    process.env.SCRCPY_SERVER_PATH?.trim() ||
    "/opt/rebroid-display-sidecar/scrcpy-server";
  readonly webrtcBridgePath =
    process.env.DISPLAY_WEBRTC_BRIDGE_PATH?.trim() ||
    "/opt/rebroid-display-sidecar/rebroid-webrtc-bridge";
  readonly webrtcUdpPortRange =
    environment.DISPLAY_WEBRTC_UDP_PORT_RANGE || "40000-40100";
  readonly webrtcIceHostOverride =
    process.env.DISPLAY_WEBRTC_ICE_HOST?.trim() || "";
  readonly webrtcStunUrls = this.csv(process.env.DISPLAY_WEBRTC_STUN_URLS);
  readonly sharedSecret = this.readSecret();
  readonly allowUnauthenticatedInternalApi =
    environment.DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API === "true";
  readonly enableApiDocs =
    (process.env.NODE_ENV ?? "development") !== "production" ||
    environment.ENABLE_API_DOCS === "true";

  get hasSharedSecret() {
    return this.sharedSecret.length > 0;
  }

  private readSecret() {
    const inline = process.env.DISPLAY_SIDECAR_SHARED_SECRET?.trim();
    if (inline) {
      return inline;
    }

    const explicitFilePath =
      process.env.DISPLAY_SIDECAR_SHARED_SECRET_FILE?.trim();
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

  private csv(value: string | undefined) {
    return (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
