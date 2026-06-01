import type { ViewerCommand } from "../adb/adb.service";
import {
  ScrcpyKeyboardEventPayload,
  ScrcpyTouchEventPayload,
} from "./scrcpy.types";

export const CONTROL_MESSAGE = {
  INJECT_KEYCODE: 0,
  INJECT_TEXT: 1,
  INJECT_TOUCH_EVENT: 2,
  BACK_OR_SCREEN_ON: 4,
  EXPAND_NOTIFICATION_PANEL: 5,
  EXPAND_SETTINGS_PANEL: 6,
  COLLAPSE_PANELS: 7,
  SET_CLIPBOARD: 9,
  SET_DISPLAY_POWER: 10,
  ROTATE_DEVICE: 11,
} as const;

const KEY_EVENT_ACTION_DOWN = 0;
const KEY_EVENT_ACTION_UP = 1;
const MOTION_EVENT_ACTION_DOWN = 0;
const MOTION_EVENT_ACTION_UP = 1;
const MOTION_EVENT_ACTION_MOVE = 2;
const POINTER_ID_GENERIC_FINGER = -2n;

const ANDROID_META_SHIFT_ON = 0x1;
const ANDROID_META_ALT_ON = 0x2;
const ANDROID_META_CTRL_ON = 0x1000;

export const VIEWER_CONTROL_COMMANDS = new Set<ViewerCommand>([
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
]);

const CONTROL_KEY_CODES: Partial<Record<ViewerCommand, number>> = {
  back: 4,
  home: 3,
  recents: 187,
  power: 26,
  wake: 224,
  sleep: 223,
  "volume-up": 24,
  "volume-down": 25,
  mute: 164,
};

const BROWSER_CONTROL_KEY_CODES: Record<string, number> = {
  Enter: 66,
  Backspace: 67,
  Delete: 112,
  Escape: 4,
  Tab: 61,
  ArrowUp: 19,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
  PageUp: 92,
  PageDown: 93,
  Home: 122,
  End: 123,
};

export class ScrcpyControlCodec {
  viewerActionPayloads(command: ViewerCommand) {
    if (command === "expand-notifications") {
      return [Buffer.from([CONTROL_MESSAGE.EXPAND_NOTIFICATION_PANEL])];
    }

    if (command === "expand-settings") {
      return [Buffer.from([CONTROL_MESSAGE.EXPAND_SETTINGS_PANEL])];
    }

    if (command === "collapse-panels") {
      return [Buffer.from([CONTROL_MESSAGE.COLLAPSE_PANELS])];
    }

    if (command === "rotate") {
      return [Buffer.from([CONTROL_MESSAGE.ROTATE_DEVICE])];
    }

    if (command === "wake") {
      return [Buffer.from([CONTROL_MESSAGE.SET_DISPLAY_POWER, 1])];
    }

    if (command === "sleep") {
      return [Buffer.from([CONTROL_MESSAGE.SET_DISPLAY_POWER, 0])];
    }

    if (command === "back") {
      return [
        this.serializeBackOrScreenOn(KEY_EVENT_ACTION_DOWN),
        this.serializeBackOrScreenOn(KEY_EVENT_ACTION_UP),
      ];
    }

    const keyCode = CONTROL_KEY_CODES[command];
    if (!keyCode) {
      return null;
    }

    return [
      this.serializeKeycode(KEY_EVENT_ACTION_DOWN, keyCode),
      this.serializeKeycode(KEY_EVENT_ACTION_UP, keyCode),
    ];
  }

  keyboardEventPayloads(event: ScrcpyKeyboardEventPayload) {
    if (event.eventType !== "keydown") {
      return null;
    }

    const metaState = this.androidMetaState(event);
    const keyCode = this.keyCodeForKeyboardEvent(event);
    if (keyCode) {
      return [
        this.serializeKeycode(KEY_EVENT_ACTION_DOWN, keyCode, metaState),
        this.serializeKeycode(KEY_EVENT_ACTION_UP, keyCode, metaState),
      ];
    }

    if (!metaState && event.key && event.key.length === 1) {
      return [this.serializeText(event.key)];
    }

    return null;
  }

  touchEventPayloads(event: ScrcpyTouchEventPayload) {
    const videoWidth = this.clampUInt16(event.videoWidth);
    const videoHeight = this.clampUInt16(event.videoHeight);
    if (!videoWidth || !videoHeight) {
      return null;
    }

    if (event.action === "swipe") {
      const from = this.touchPoint(event.x1, event.y1);
      const to = this.touchPoint(event.x2, event.y2);
      return [
        this.serializeTouch(
          MOTION_EVENT_ACTION_DOWN,
          from.x,
          from.y,
          videoWidth,
          videoHeight,
          1,
        ),
        this.serializeTouch(
          MOTION_EVENT_ACTION_MOVE,
          to.x,
          to.y,
          videoWidth,
          videoHeight,
          1,
        ),
        this.serializeTouch(
          MOTION_EVENT_ACTION_UP,
          to.x,
          to.y,
          videoWidth,
          videoHeight,
          0,
        ),
      ];
    }

    if (event.action === "pointer") {
      const point = this.touchPoint(event.x, event.y);
      const action =
        event.eventType === "down"
          ? MOTION_EVENT_ACTION_DOWN
          : event.eventType === "move"
            ? MOTION_EVENT_ACTION_MOVE
            : MOTION_EVENT_ACTION_UP;
      return [
        this.serializeTouch(
          action,
          point.x,
          point.y,
          videoWidth,
          videoHeight,
          action === MOTION_EVENT_ACTION_UP ? 0 : 1,
        ),
      ];
    }

    const point = this.touchPoint(event.x ?? event.x1, event.y ?? event.y1);
    return [
      this.serializeTouch(
        MOTION_EVENT_ACTION_DOWN,
        point.x,
        point.y,
        videoWidth,
        videoHeight,
        1,
      ),
      this.serializeTouch(
        MOTION_EVENT_ACTION_UP,
        point.x,
        point.y,
        videoWidth,
        videoHeight,
        0,
      ),
    ];
  }

  clipboardPayload(text: string) {
    return this.serializeClipboard(text);
  }

  private keyCodeForKeyboardEvent(event: ScrcpyKeyboardEventPayload) {
    if (event.key) {
      const special = BROWSER_CONTROL_KEY_CODES[event.key];
      if (special) {
        return special;
      }

      if (
        event.key.length === 1 &&
        (event.ctrlKey || event.metaKey || event.altKey)
      ) {
        return this.androidKeyCodeForPrintableKey(event.key);
      }
    }

    return event.code ? this.androidKeyCodeForCode(event.code) : null;
  }

  private androidKeyCodeForPrintableKey(key: string) {
    const lower = key.toLowerCase();
    if (lower >= "a" && lower <= "z") {
      return 29 + lower.charCodeAt(0) - "a".charCodeAt(0);
    }

    if (lower >= "0" && lower <= "9") {
      return 7 + Number(lower);
    }

    return null;
  }

  private androidKeyCodeForCode(code: string) {
    if (/^Key[A-Z]$/.test(code)) {
      return 29 + code.charCodeAt(3) - "A".charCodeAt(0);
    }

    if (/^Digit[0-9]$/.test(code)) {
      return 7 + Number(code.slice(5));
    }

    return null;
  }

  private androidMetaState(event: ScrcpyKeyboardEventPayload) {
    let metaState = 0;
    if (event.shiftKey) {
      metaState |= ANDROID_META_SHIFT_ON;
    }
    if (event.altKey) {
      metaState |= ANDROID_META_ALT_ON;
    }
    if (event.ctrlKey || event.metaKey) {
      metaState |= ANDROID_META_CTRL_ON;
    }
    return metaState;
  }

  private serializeKeycode(action: number, keyCode: number, metaState = 0) {
    const payload = Buffer.alloc(14);
    payload.writeUInt8(CONTROL_MESSAGE.INJECT_KEYCODE, 0);
    payload.writeUInt8(action, 1);
    payload.writeInt32BE(keyCode, 2);
    payload.writeInt32BE(0, 6);
    payload.writeInt32BE(metaState, 10);
    return payload;
  }

  private serializeBackOrScreenOn(action: number) {
    return Buffer.from([CONTROL_MESSAGE.BACK_OR_SCREEN_ON, action]);
  }

  private serializeText(text: string) {
    const textBytes = Buffer.from(text, "utf8");
    const payload = Buffer.alloc(5 + textBytes.byteLength);
    payload.writeUInt8(CONTROL_MESSAGE.INJECT_TEXT, 0);
    payload.writeUInt32BE(textBytes.byteLength, 1);
    textBytes.copy(payload, 5);
    return payload;
  }

  private serializeClipboard(text: string) {
    const textBytes = Buffer.from(text, "utf8");
    const payload = Buffer.alloc(14 + textBytes.byteLength);
    payload.writeUInt8(CONTROL_MESSAGE.SET_CLIPBOARD, 0);
    payload.writeBigInt64BE(0n, 1);
    payload.writeUInt8(0, 9);
    payload.writeUInt32BE(textBytes.byteLength, 10);
    textBytes.copy(payload, 14);
    return payload;
  }

  private serializeTouch(
    action: number,
    x: number,
    y: number,
    videoWidth: number,
    videoHeight: number,
    pressure: number,
  ) {
    const payload = Buffer.alloc(32);
    payload.writeUInt8(CONTROL_MESSAGE.INJECT_TOUCH_EVENT, 0);
    payload.writeUInt8(action, 1);
    payload.writeBigInt64BE(POINTER_ID_GENERIC_FINGER, 2);
    payload.writeInt32BE(x, 10);
    payload.writeInt32BE(y, 14);
    payload.writeUInt16BE(videoWidth, 18);
    payload.writeUInt16BE(videoHeight, 20);
    payload.writeUInt16BE(pressure > 0 ? 0xffff : 0, 22);
    payload.writeInt32BE(0, 24);
    payload.writeInt32BE(0, 28);
    return payload;
  }

  private touchPoint(x: number | undefined, y: number | undefined) {
    return {
      x: Math.max(0, Math.round(this.finiteNumber(x))),
      y: Math.max(0, Math.round(this.finiteNumber(y))),
    };
  }

  private clampUInt16(value: number | undefined) {
    const parsed = this.finiteNumber(value);
    if (parsed <= 0) {
      return 0;
    }
    return Math.min(Math.round(parsed), 0xffff);
  }

  private finiteNumber(value: number | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
}
