import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ChildProcessByStdio, spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

export type AdbChildProcess = ChildProcessByStdio<null, Readable, Readable>;

const MAX_ADB_TEXT_OUTPUT_BYTES = Number(
  process.env.ADB_TEXT_OUTPUT_MAX_BYTES ?? 2 * 1024 * 1024,
);
const MAX_ADB_BINARY_OUTPUT_BYTES = Number(
  process.env.ADB_BINARY_OUTPUT_MAX_BYTES ?? 64 * 1024 * 1024,
);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface BoundedOutput {
  chunks: Buffer[];
  byteLength: number;
  truncatedBytes: number;
}

export type ViewerCommand =
  | "back"
  | "home"
  | "recents"
  | "power"
  | "wake"
  | "sleep"
  | "volume-up"
  | "volume-down"
  | "mute"
  | "rotate"
  | "expand-notifications"
  | "expand-settings"
  | "collapse-panels";

const KEY_EVENTS: Partial<Record<ViewerCommand, string>> = {
  back: "KEYCODE_BACK",
  home: "KEYCODE_HOME",
  recents: "KEYCODE_APP_SWITCH",
  power: "KEYCODE_POWER",
  wake: "KEYCODE_WAKEUP",
  sleep: "KEYCODE_SLEEP",
  "volume-up": "KEYCODE_VOLUME_UP",
  "volume-down": "KEYCODE_VOLUME_DOWN",
  mute: "KEYCODE_MUTE",
};

const BROWSER_KEY_EVENTS: Record<string, string> = {
  Enter: "KEYCODE_ENTER",
  Backspace: "KEYCODE_DEL",
  Delete: "KEYCODE_FORWARD_DEL",
  Escape: "KEYCODE_BACK",
  Tab: "KEYCODE_TAB",
  ArrowUp: "KEYCODE_DPAD_UP",
  ArrowDown: "KEYCODE_DPAD_DOWN",
  ArrowLeft: "KEYCODE_DPAD_LEFT",
  ArrowRight: "KEYCODE_DPAD_RIGHT",
  PageUp: "KEYCODE_PAGE_UP",
  PageDown: "KEYCODE_PAGE_DOWN",
  Home: "KEYCODE_MOVE_HOME",
  End: "KEYCODE_MOVE_END",
};

export interface BrowserKeyboardEventPayload {
  eventType?: "keydown" | "keyup";
  key?: string;
  code?: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface BrowserTouchEventPayload {
  action?: "tap" | "swipe" | "pointer";
  eventType?: "down" | "move" | "up" | "cancel";
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  videoWidth?: number;
  videoHeight?: number;
  durationMs?: number;
}

@Injectable()
export class AdbService {
  readonly adbPath = process.env.ADB_PATH?.trim() || "adb";

  async connect(udid: string) {
    return this.adb(["connect", udid], 15_000);
  }

  async getState(udid: string) {
    return this.adb(["-s", udid, "get-state"], 10_000);
  }

  async ensureConnected(udid: string) {
    await this.connect(udid);
    const state = await this.getState(udid);
    if (state.stdout.trim() !== "device") {
      throw new InternalServerErrorException(
        `ADB transport ${udid} is ${state.stdout.trim() || "unknown"}.`,
      );
    }
    return state;
  }

  async logcat(udid: string, tail = 300) {
    return this.adb(
      ["-s", udid, "logcat", "-d", "-v", "threadtime", "-t", String(tail)],
      20_000,
    );
  }

  async notifications(udid: string) {
    try {
      return await this.shell(
        udid,
        ["dumpsys", "notification", "--noredact"],
        20_000,
      );
    } catch {
      return this.shell(udid, ["dumpsys", "notification"], 20_000);
    }
  }

  async screencapPng(udid: string, timeoutMs = 8_000) {
    return this.adbBuffer(
      ["-s", udid, "exec-out", "screencap", "-p"],
      timeoutMs,
    );
  }

  async shell(udid: string, args: string[], timeoutMs = 15_000) {
    return this.adb(["-s", udid, "shell", ...args], timeoutMs);
  }

  async pushFile(
    udid: string,
    source: string,
    target: string,
    timeoutMs = 30_000,
  ) {
    return this.adb(["-s", udid, "push", source, target], timeoutMs);
  }

  async pushFileContent(udid: string, target: string, contentBase64: string) {
    const directory = await mkdtemp(join(tmpdir(), "rebroid-adb-push-"));
    const source = join(directory, "content");
    try {
      await writeFile(source, Buffer.from(contentBase64, "base64"));
      return await this.pushFile(udid, source, target);
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }

  async pullFileContent(udid: string, path: string) {
    const content = await this.adbBuffer(
      ["-s", udid, "exec-out", "cat", path],
      15_000,
    );
    return {
      path,
      contentBase64: content.toString("base64"),
      sizeBytes: content.byteLength,
    };
  }

  async deleteFile(udid: string, path: string) {
    return this.shell(udid, ["rm", "-f", path], 10_000);
  }

  async fileExists(udid: string, path: string) {
    const result = await this.shell(
      udid,
      ["sh", "-lc", `[ -e ${this.shellQuote(path)} ] && echo yes || echo no`],
      5_000,
    );
    return result.stdout.trim() === "yes";
  }

  async listFiles(udid: string, path: string) {
    const result = await this.shell(
      udid,
      ["sh", "-lc", `ls -1A ${this.shellQuote(path)}`],
      10_000,
    );
    return result.stdout
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async forward(
    udid: string,
    localPort: number,
    remote: string,
    timeoutMs = 10_000,
  ) {
    return this.adb(
      ["-s", udid, "forward", `tcp:${localPort}`, remote],
      timeoutMs,
    );
  }

  async removeForward(udid: string, localPort: number, timeoutMs = 5_000) {
    return this.adb(
      ["-s", udid, "forward", "--remove", `tcp:${localPort}`],
      timeoutMs,
    );
  }

  async reverse(
    udid: string,
    remote: string,
    local: string,
    timeoutMs = 10_000,
  ) {
    return this.adb(["-s", udid, "reverse", remote, local], timeoutMs);
  }

  async removeReverse(udid: string, remote: string, timeoutMs = 5_000) {
    return this.adb(["-s", udid, "reverse", "--remove", remote], timeoutMs);
  }

  spawnAdb(args: string[]): AdbChildProcess {
    return spawn(this.adbPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  }

  async getClipboard(udid: string) {
    try {
      const result = await this.shell(udid, ["cmd", "clipboard", "get"], 5_000);
      return {
        text: result.stdout.trimEnd(),
        supported: true,
      };
    } catch {
      return {
        text: "",
        supported: false,
      };
    }
  }

  async setClipboard(udid: string, text: string) {
    try {
      await this.shell(
        udid,
        ["sh", "-lc", `cmd clipboard set ${this.shellQuote(text)}`],
        5_000,
      );
      return {
        text,
        supported: true,
      };
    } catch {
      return {
        text: "",
        supported: false,
      };
    }
  }

  async viewerAction(udid: string, command: ViewerCommand) {
    if (command === "rotate") {
      return this.rotateDisplay(udid);
    }

    if (command === "expand-notifications") {
      return this.shell(udid, ["cmd", "statusbar", "expand-notifications"]);
    }

    if (command === "expand-settings") {
      return this.shell(udid, ["cmd", "statusbar", "expand-settings"]);
    }

    if (command === "collapse-panels") {
      return this.shell(udid, ["cmd", "statusbar", "collapse"]);
    }

    const key = KEY_EVENTS[command];
    if (!key) {
      throw new InternalServerErrorException(
        `Unsupported viewer command: ${command}`,
      );
    }

    return this.shell(udid, ["input", "keyevent", key]);
  }

  async keyboardEvent(udid: string, event: BrowserKeyboardEventPayload) {
    if (event.eventType !== "keydown") {
      return this.noop();
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return this.noop();
    }

    const specialKey = event.key ? BROWSER_KEY_EVENTS[event.key] : null;
    if (specialKey) {
      return this.shell(udid, ["input", "keyevent", specialKey], 5_000);
    }

    if (event.key && event.key.length === 1) {
      return this.shell(
        udid,
        ["input", "text", this.escapeInputText(event.key)],
        5_000,
      );
    }

    return this.noop();
  }

  async touchEvent(udid: string, event: BrowserTouchEventPayload) {
    const videoWidth = this.positiveNumber(event.videoWidth);
    const videoHeight = this.positiveNumber(event.videoHeight);
    const displaySize = await this.getDisplaySize(udid).catch(() => null);
    const scaleX =
      displaySize && videoWidth ? displaySize.width / videoWidth : 1;
    const scaleY =
      displaySize && videoHeight ? displaySize.height / videoHeight : 1;
    const duration = this.clampNumber(event.durationMs, 50, 2_000, 120);

    if (event.action === "pointer") {
      return this.noop();
    }

    if (event.action === "swipe") {
      const from = this.touchPoint(event.x1, event.y1, scaleX, scaleY);
      const to = this.touchPoint(event.x2, event.y2, scaleX, scaleY);
      return this.shell(
        udid,
        [
          "input",
          "swipe",
          String(from.x),
          String(from.y),
          String(to.x),
          String(to.y),
          String(duration),
        ],
        5_000,
      );
    }

    const point = this.touchPoint(
      event.x ?? event.x1,
      event.y ?? event.y1,
      scaleX,
      scaleY,
    );
    return this.shell(
      udid,
      ["input", "tap", String(point.x), String(point.y)],
      5_000,
    );
  }

  async tap(udid: string, x: number, y: number) {
    return this.shell(udid, ["input", "tap", String(x), String(y)], 5_000);
  }

  async swipe(
    udid: string,
    input: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs?: number;
    },
  ) {
    return this.shell(
      udid,
      [
        "input",
        "swipe",
        String(input.x1),
        String(input.y1),
        String(input.x2),
        String(input.y2),
        String(this.clampNumber(input.durationMs, 50, 5_000, 300)),
      ],
      10_000,
    );
  }

  async inputText(udid: string, text: string) {
    return this.shell(
      udid,
      ["input", "text", this.escapeInputText(text)],
      10_000,
    );
  }

  async keyEvent(udid: string, key: string) {
    const normalized = key
      .trim()
      .toUpperCase()
      .replace(/^KEYCODE_/, "");
    return this.shell(
      udid,
      ["input", "keyevent", `KEYCODE_${normalized}`],
      5_000,
    );
  }

  async rotateDisplayTo(
    udid: string,
    orientation:
      | "portrait"
      | "landscape"
      | "reverse-portrait"
      | "reverse-landscape",
  ) {
    const rotationByOrientation = {
      portrait: "0",
      landscape: "1",
      "reverse-portrait": "2",
      "reverse-landscape": "3",
    } as const;
    await this.shell(
      udid,
      ["settings", "put", "system", "accelerometer_rotation", "0"],
      5_000,
    );
    return this.shell(
      udid,
      [
        "settings",
        "put",
        "system",
        "user_rotation",
        rotationByOrientation[orientation],
      ],
      5_000,
    );
  }

  async shellCommand(udid: string, command: string, timeoutMs = 15_000) {
    return this.shell(udid, ["sh", "-lc", command], timeoutMs);
  }

  async dumpUi(udid: string) {
    const dumpPath = `/data/local/tmp/rebroid-window-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`;
    try {
      await this.shell(
        udid,
        [
          "sh",
          "-lc",
          `rm -f ${this.shellQuote(dumpPath)} && uiautomator dump ${this.shellQuote(dumpPath)} >/dev/null`,
        ],
        10_000,
      );
      const result = await this.shell(udid, ["cat", dumpPath], 10_000);
      const xml = result.stdout.trim();
      if (!xml.includes("<hierarchy")) {
        throw new InternalServerErrorException(
          "UI hierarchy dump did not produce hierarchy XML.",
        );
      }
      return xml;
    } catch (error) {
      throw new InternalServerErrorException(
        `UI hierarchy dump failed: ${this.errorMessage(error)}`,
      );
    } finally {
      await this.shell(udid, ["rm", "-f", dumpPath], 5_000).catch(() => {});
    }
  }

  async tapText(udid: string, text: string) {
    const xml = await this.dumpUi(udid).catch(() => "");
    if (!xml) {
      return { found: false, x: null, y: null };
    }
    const escaped = this.escapeRegExp(this.escapeXml(text));
    const pattern = new RegExp(
      `<node\\b[^>]*(?:text="${escaped}"|content-desc="${escaped}")[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    );
    const match = xml.match(pattern);
    if (!match) {
      return { found: false, x: null, y: null };
    }

    const x = Math.round((Number(match[1]) + Number(match[3])) / 2);
    const y = Math.round((Number(match[2]) + Number(match[4])) / 2);
    await this.tap(udid, x, y);
    return { found: true, x, y };
  }

  private async rotateDisplay(udid: string) {
    let nextRotation = "1";

    try {
      const current = await this.shell(
        udid,
        ["settings", "get", "system", "user_rotation"],
        5_000,
      );
      const currentRotation = Number(current.stdout.trim());
      nextRotation = String(
        Number.isFinite(currentRotation) ? (currentRotation + 1) % 4 : 1,
      );
    } catch {
      nextRotation = "1";
    }

    await this.shell(
      udid,
      ["settings", "put", "system", "accelerometer_rotation", "0"],
      5_000,
    );
    return this.shell(
      udid,
      ["settings", "put", "system", "user_rotation", nextRotation],
      5_000,
    );
  }

  private escapeInputText(value: string) {
    return value.replace(/%/g, "%25").replace(/\s/g, "%s");
  }

  private async getDisplaySize(udid: string) {
    const result = await this.shell(udid, ["wm", "size"], 5_000);
    const matches = [...result.stdout.matchAll(/(\d+)x(\d+)/g)];
    const match = matches[matches.length - 1];
    if (!match) {
      return null;
    }

    return {
      width: Number(match[1]),
      height: Number(match[2]),
    };
  }

  private touchPoint(
    x: number | undefined,
    y: number | undefined,
    scaleX: number,
    scaleY: number,
  ) {
    return {
      x: Math.max(0, Math.round(this.finiteNumber(x) * scaleX)),
      y: Math.max(0, Math.round(this.finiteNumber(y) * scaleY)),
    };
  }

  private positiveNumber(value: number | undefined) {
    const parsed = this.finiteNumber(value);
    return parsed > 0 ? parsed : null;
  }

  private clampNumber(
    value: number | undefined,
    min: number,
    max: number,
    fallback: number,
  ) {
    const parsed = this.finiteNumber(value);
    if (parsed <= 0) {
      return fallback;
    }

    return Math.min(Math.max(Math.round(parsed), min), max);
  }

  private finiteNumber(value: number | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private noop(): CommandResult {
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
    };
  }

  private adb(args: string[], timeoutMs: number) {
    return new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(this.adbPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout = this.createBoundedOutput();
      const stderr = this.createBoundedOutput();
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) =>
        this.pushBoundedOutput(stdout, chunk, MAX_ADB_TEXT_OUTPUT_BYTES),
      );
      child.stderr.on("data", (chunk: Buffer) =>
        this.pushBoundedOutput(stderr, chunk, MAX_ADB_TEXT_OUTPUT_BYTES),
      );
      child.on("error", reject);
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        const result = {
          stdout: this.boundedOutputToString(stdout),
          stderr: this.boundedOutputToString(stderr),
          exitCode: exitCode ?? 0,
        };

        if (timedOut) {
          reject(
            new InternalServerErrorException(
              `adb ${args.join(" ")} timed out after ${timeoutMs}ms`,
            ),
          );
          return;
        }

        if (result.exitCode !== 0) {
          reject(
            new InternalServerErrorException(
              `adb ${args.join(" ")} failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`,
            ),
          );
          return;
        }

        resolve(result);
      });
    });
  }

  private adbBuffer(args: string[], timeoutMs: number) {
    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn(this.adbPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout = this.createBoundedOutput();
      const stderr = this.createBoundedOutput();
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) =>
        this.pushBoundedOutput(stdout, chunk, MAX_ADB_BINARY_OUTPUT_BYTES),
      );
      child.stderr.on("data", (chunk: Buffer) =>
        this.pushBoundedOutput(stderr, chunk, MAX_ADB_TEXT_OUTPUT_BYTES),
      );
      child.on("error", reject);
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        const output = this.boundedOutputToBuffer(stdout);
        const error = this.boundedOutputToString(stderr);

        if (timedOut) {
          reject(
            new InternalServerErrorException(
              `adb ${args.join(" ")} timed out after ${timeoutMs}ms`,
            ),
          );
          return;
        }

        if ((exitCode ?? 0) !== 0) {
          reject(
            new InternalServerErrorException(
              `adb ${args.join(" ")} failed with exit code ${exitCode ?? 0}: ${error || output.toString("utf8")}`,
            ),
          );
          return;
        }

        if (stdout.truncatedBytes > 0) {
          reject(
            new InternalServerErrorException(
              `adb ${args.join(" ")} produced more than ${MAX_ADB_BINARY_OUTPUT_BYTES} bytes of output.`,
            ),
          );
          return;
        }

        resolve(output);
      });
    });
  }

  private createBoundedOutput(): BoundedOutput {
    return {
      chunks: [],
      byteLength: 0,
      truncatedBytes: 0,
    };
  }

  private pushBoundedOutput(
    output: BoundedOutput,
    chunk: Buffer,
    maxBytes: number,
  ) {
    const remaining = maxBytes - output.byteLength;
    if (remaining <= 0) {
      output.truncatedBytes += chunk.byteLength;
      return;
    }

    if (chunk.byteLength <= remaining) {
      output.chunks.push(chunk);
      output.byteLength += chunk.byteLength;
      return;
    }

    output.chunks.push(chunk.subarray(0, remaining));
    output.byteLength += remaining;
    output.truncatedBytes += chunk.byteLength - remaining;
  }

  private boundedOutputToBuffer(output: BoundedOutput) {
    return Buffer.concat(output.chunks, output.byteLength);
  }

  private boundedOutputToString(output: BoundedOutput) {
    const text = this.boundedOutputToBuffer(output).toString("utf8");
    if (!output.truncatedBytes) {
      return text;
    }

    return `${text}\n[truncated ${output.truncatedBytes} bytes]`;
  }
}
