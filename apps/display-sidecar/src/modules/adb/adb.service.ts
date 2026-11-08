import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ViewerCommand } from "@rebroid/android-application-core/viewer-control";

import {
  AdbCommandRunner,
  type AdbChildProcess,
  type AdbCommandResult,
} from "./adb-command-runner";
import {
  clampDuration,
  escapeAdbInputText,
  keyboardCommand,
  touchCommand,
} from "./adb-input";
import type {
  KeyboardControlPayload,
  TouchControlPayload,
} from "../shared/display-control.types";
export type { AdbChildProcess } from "./adb-command-runner";

export type CommandResult = AdbCommandResult;

export interface UiDumpDiagnostics {
  command: string;
  compressed: boolean;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  xmlBytes: number;
  rawNodeCount: number;
}

export interface UiDumpResult {
  status: "available" | "failed";
  xml?: string;
  error?: string;
  diagnostics?: UiDumpDiagnostics;
  attempts: UiDumpDiagnostics[];
}

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

@Injectable()
export class AdbService {
  constructor(private readonly runner: AdbCommandRunner) {}

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

  async shellResult(udid: string, args: string[], timeoutMs = 15_000) {
    return this.adb(["-s", udid, "shell", ...args], timeoutMs, {
      rejectOnNonZero: false,
    });
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
    return this.runner.spawn(args);
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

  async keyboardEvent(udid: string, event: KeyboardControlPayload) {
    const args = keyboardCommand(event);
    return args ? this.shell(udid, args, 5_000) : this.noop();
  }

  async touchEvent(udid: string, event: TouchControlPayload) {
    const displaySize = await this.getDisplaySize(udid).catch(() => null);
    const args = touchCommand(event, displaySize);
    return args ? this.shell(udid, args, 5_000) : this.noop();
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
        String(clampDuration(input.durationMs, 50, 5_000, 300)),
      ],
      10_000,
    );
  }

  async inputText(udid: string, text: string) {
    return this.shell(
      udid,
      ["input", "text", escapeAdbInputText(text)],
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
    return this.shellResult(udid, ["sh", "-c", command], timeoutMs);
  }

  async dumpUi(udid: string) {
    const dumpPath = `/data/local/tmp/rebroid-window-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`;
    const attempts: UiDumpDiagnostics[] = [];
    try {
      for (const compressed of [false, true]) {
        const attempt = await this.runUiDumpAttempt(udid, dumpPath, compressed);
        attempts.push(attempt.diagnostics);
        if (attempt.xml) {
          return {
            status: "available" as const,
            xml: attempt.xml,
            diagnostics: attempt.diagnostics,
            attempts,
          };
        }
      }
      return {
        status: "failed" as const,
        error: this.summarizeUiDumpFailure(attempts),
        diagnostics: attempts.at(-1),
        attempts,
      };
    } catch (error) {
      return {
        status: "failed" as const,
        error: `UI hierarchy dump failed: ${this.errorMessage(error)}`,
        attempts,
      };
    } finally {
      await this.shell(udid, ["rm", "-f", dumpPath], 5_000).catch(() => {});
    }
  }

  async tapText(udid: string, text: string) {
    const dump = await this.dumpUi(udid).catch(() => null);
    const xml = dump?.status === "available" ? (dump.xml ?? "") : "";
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

  private async runUiDumpAttempt(
    udid: string,
    dumpPath: string,
    compressed: boolean,
  ): Promise<{ xml?: string; diagnostics: UiDumpDiagnostics }> {
    const dumpArgs = [
      "uiautomator",
      "dump",
      ...(compressed ? ["--compressed"] : []),
      dumpPath,
    ];
    const command = dumpArgs.map((arg) => this.shellQuote(arg)).join(" ");
    const started = Date.now();
    await this.shellResult(udid, ["rm", "-f", dumpPath], 5_000);
    const dump = await this.shellResult(udid, dumpArgs, 10_000);
    let xml = "";
    let catResult: CommandResult | null = null;
    if (dump.exitCode === 0) {
      catResult = await this.shellResult(udid, ["cat", dumpPath], 10_000);
      if (catResult.exitCode === 0) {
        xml = catResult.stdout.trim();
      }
    }
    const stderr = [dump.stderr, catResult?.stderr].filter(Boolean).join("\n");
    const stdout = [
      dump.stdout,
      catResult?.stdout && !xml ? catResult.stdout : "",
    ]
      .filter(Boolean)
      .join("\n");
    const diagnostics: UiDumpDiagnostics = {
      command,
      compressed,
      durationMs: Date.now() - started,
      exitCode:
        dump.exitCode !== 0 ? dump.exitCode : (catResult?.exitCode ?? 0),
      stdout: this.boundedExcerpt(stdout),
      stderr: this.boundedExcerpt(stderr),
      xmlBytes: Buffer.byteLength(xml),
      rawNodeCount: this.countUiNodes(xml),
    };
    if (!xml.includes("<hierarchy")) {
      return { diagnostics };
    }
    return { xml, diagnostics };
  }

  private summarizeUiDumpFailure(attempts: UiDumpDiagnostics[]) {
    const parts = attempts.map((attempt) => {
      const mode = attempt.compressed ? "compressed" : "normal";
      const detail =
        attempt.stderr || attempt.stdout || `exit code ${attempt.exitCode}`;
      return `${mode}: ${detail}`;
    });
    return `UI hierarchy dump failed. ${parts.join("; ")}`;
  }

  private countUiNodes(xml: string) {
    return [...xml.matchAll(/<node\b/g)].length;
  }

  private boundedExcerpt(value: string, maxLength = 1_000) {
    const normalized = value.replace(/\s+$/g, "");
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength)}...[truncated ${normalized.length - maxLength} chars]`;
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

  private adb(
    args: string[],
    timeoutMs: number,
    options: { rejectOnNonZero?: boolean } = {},
  ) {
    return this.runner.text(args, timeoutMs, options);
  }

  private adbBuffer(args: string[], timeoutMs: number) {
    return this.runner.buffer(args, timeoutMs);
  }
}
