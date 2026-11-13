import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { connectWebrtcBridge } from "./display-webrtc-bridge";

const startupTimeoutMs = 5_000;
const shutdownGraceMs = 1_000;

export class DisplayWebrtcProcess {
  private readonly logger = new Logger(DisplayWebrtcProcess.name);
  private process?: { ready: Promise<string>; stop: () => void };
  private stopping = false;

  constructor(
    private readonly executable: string,
    private readonly port: number,
    private readonly maxPeers: number,
  ) {}

  async connect(signal: AbortSignal, attemptId: string) {
    signal.throwIfAborted();
    if (this.stopping)
      throw new ServiceUnavailableException("WebRTC is shutting down.");
    this.process ??= this.start();
    const path = await this.process.ready;
    signal.throwIfAborted();
    if (this.stopping)
      throw new ServiceUnavailableException("WebRTC is shutting down.");
    return connectWebrtcBridge(path, attemptId);
  }

  close() {
    this.stopping = true;
    this.process?.stop();
  }

  private start() {
    // Use a short private directory because Unix socket paths are length limited.
    const directory = mkdtempSync(
      join(process.platform === "darwin" ? "/tmp" : tmpdir(), "rbd-rtc-"),
    );
    const path = join(directory, "bridge.sock");
    const child = spawn(
      this.executable,
      [path, String(this.port), String(this.maxPeers)],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    child.stdin.on("error", () => undefined);
    const output = createInterface({ input: child.stdout });
    let killTimer: NodeJS.Timeout | undefined;
    const stop = () => {
      if (killTimer || child.exitCode !== null || child.signalCode !== null)
        return;
      child.stdin.end();
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), shutdownGraceMs);
      killTimer.unref();
    };
    const failure = () =>
      new ServiceUnavailableException("WebRTC bridge is unavailable.");
    let startupTimer: NodeJS.Timeout | undefined;
    const ready = new Promise<string>((resolve, reject) => {
      startupTimer = setTimeout(() => {
        reject(failure());
        stop();
      }, startupTimeoutMs);
      output.on("line", (line) => {
        if (line === "ready") {
          clearTimeout(startupTimer);
          resolve(path);
        }
      });
      child.once("error", (error) => {
        this.logger.error(error.message);
        reject(failure());
      });
      child.once("close", () => reject(failure()));
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      this.logger.warn(chunk.trim());
    });
    child.once("close", () => {
      clearTimeout(killTimer);
      clearTimeout(startupTimer);
      output.close();
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch (error) {
        this.logger.warn(String(error));
      }
      if (this.process === processHandle) this.process = undefined;
    });
    const processHandle = { ready, stop };
    return processHandle;
  }
}
