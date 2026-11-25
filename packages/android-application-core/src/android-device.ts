export const managedAndroidDeviceKind = "managed";

export const managedAndroidDeviceOperations = [
  "configure",
  "clone",
  "start",
  "stop",
  "recreate",
  "remove",
  "profiles",
  "viewer",
  "files",
  "network-policy",
] as const;

export type ManagedAndroidDeviceKind = typeof managedAndroidDeviceKind;
export type ManagedAndroidDeviceOperation =
  (typeof managedAndroidDeviceOperations)[number];

export const externalDeviceTransports = ["usb", "tcp"] as const;
export const externalDeviceStates = [
  "disconnected",
  "connecting",
  "awaiting_android_approval",
  "awaiting_usb_replug",
  "awaiting_verification",
  "ready",
  "offline",
] as const;
export const externalDeviceFailures = [
  "transport_unavailable",
  "verification_required",
  "attempt_expired",
  "broker_unavailable",
] as const;

export type ExternalDeviceTransport = (typeof externalDeviceTransports)[number];
export type ExternalDeviceState = (typeof externalDeviceStates)[number];
export type ExternalDeviceFailure = (typeof externalDeviceFailures)[number];

export const externalAdbTcpCheckStatuses = [
  "reachable",
  "not_allowed",
  "refused",
  "timed_out",
  "unreachable",
] as const;
export type ExternalAdbTcpCheckStatus =
  (typeof externalAdbTcpCheckStatuses)[number];

export interface ExternalDeviceConnection {
  state: ExternalDeviceState;
  failure: ExternalDeviceFailure | null;
  attemptId: string | null;
  attachmentId: string | null;
  observedAt: string | null;
}

export const externalDeviceChallengePath =
  "/data/local/tmp/rebroid-enrollment-challenge";

export const externalDeviceVerificationProofs = [
  "physical",
  "challenge",
  "android_prompt",
] as const;
export type ExternalDeviceVerificationProof =
  (typeof externalDeviceVerificationProofs)[number];

export type ExternalAutomationOperation =
  | { operation: "tap"; x: number; y: number }
  | {
      operation: "swipe";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs: number;
    }
  | { operation: "text" | "writeClipboard"; text: string }
  | { operation: "key"; key: string }
  | { operation: "launch"; packageName: string }
  | { operation: "viewer"; command: import("./viewer-control").ViewerCommand }
  | { operation: "readClipboard" | "dumpUi" };

export function isExternalAdbTcpEndpoint(endpoint: string) {
  const match =
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):([1-9]\d{0,4})$/.exec(
      endpoint,
    );
  if (!match) return false;
  const [a, b, c, , port] = match.slice(1).map(Number);
  if (
    match
      .slice(1, 5)
      .some((value) => String(Number(value)) !== value || Number(value) > 255)
  ) {
    return false;
  }
  return (
    port <= 65535 &&
    a > 0 &&
    a < 224 &&
    a !== 127 &&
    !(a === 169 && b === 254) &&
    !(a === 100 && b === 100 && c === 100)
  );
}
