import {
  keyboardCaptureMessageType,
  keyboardEventMessageType,
  viewerControlMessageType,
} from "./config.js";
import type { JsonRecord } from "./types.js";

export const isControlRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

type ParentControlMessage =
  | { kind: "keyboard-capture"; enabled: boolean }
  | { kind: "action"; command: string; requestId?: string }
  | {
      kind: "keyboard";
      key: string;
      eventType: "keydown" | "keyup";
      payload: JsonRecord;
    };

export function decodeParentControlMessage(
  data: unknown,
): ParentControlMessage | undefined {
  if (!isControlRecord(data)) return;
  if (
    data.type === keyboardCaptureMessageType &&
    typeof data.enabled === "boolean"
  ) {
    return { kind: "keyboard-capture", enabled: data.enabled };
  }
  if (
    data.type === viewerControlMessageType &&
    typeof data.command === "string"
  ) {
    return {
      kind: "action",
      command: data.command,
      requestId:
        typeof data.requestId === "string" ? data.requestId : undefined,
    };
  }
  if (
    data.type !== keyboardEventMessageType ||
    (data.eventType !== "keydown" && data.eventType !== "keyup")
  )
    return;

  const code = typeof data.code === "string" ? data.code : "";
  const key = typeof data.key === "string" ? data.key : "";
  if (!code && !key) return;
  return {
    kind: "keyboard",
    key: code || key,
    eventType: data.eventType,
    payload: {
      eventType: data.eventType,
      key,
      code,
      repeat: data.repeat === true,
      altKey: data.altKey === true,
      ctrlKey: data.ctrlKey === true,
      metaKey: data.metaKey === true,
      shiftKey: data.shiftKey === true,
    },
  };
}

type ControlReply =
  | { kind: "ready"; canControl: boolean }
  | {
      kind: "result";
      id: string;
      executed: boolean;
      payload: Record<string, unknown>;
    }
  | { kind: "codec-changed" }
  | { kind: "video-reset"; remainingMs: number }
  | { kind: "status"; payload: JsonRecord };

export function decodeControlReply(data: unknown): ControlReply | undefined {
  if (typeof data !== "string") return;
  let reply: unknown;
  try {
    reply = JSON.parse(data);
  } catch {
    return;
  }
  if (!isControlRecord(reply)) return;
  if (reply.type === "control-ready") {
    return { kind: "ready", canControl: reply.canControl !== false };
  }
  if (typeof reply.id === "string" && typeof reply.ok === "boolean") {
    return {
      kind: "result",
      id: reply.id,
      executed: reply.ok && reply.executed !== false,
      payload: reply,
    };
  }
  if (reply.type === "webrtc-codec-changed") {
    if (
      data.length <= 256 &&
      typeof reply.consumerAttemptId === "string" &&
      reply.consumerAttemptId.length > 0 &&
      reply.consumerAttemptId.length <= 128
    )
      return { kind: "codec-changed" };
    return;
  }
  if (reply.type === "webrtc-video-reset") {
    if (
      typeof reply.remainingMs === "number" &&
      Number.isSafeInteger(reply.remainingMs) &&
      reply.remainingMs > 0
    )
      return { kind: "video-reset", remainingMs: reply.remainingMs };
    return;
  }
  return { kind: "status", payload: reply as JsonRecord };
}
