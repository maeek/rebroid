import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { SidecarConfigService } from "../shared/sidecar-config.service";

export type AdbChildProcess = ChildProcessByStdio<null, Readable, Readable>;
export interface AdbCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

type BoundedOutput = {
  chunks: Buffer[];
  byteLength: number;
  truncatedBytes: number;
};

@Injectable()
export class AdbCommandRunner {
  constructor(private readonly config: SidecarConfigService) {}

  spawn(args: string[]): AdbChildProcess {
    return spawn(this.config.adbPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  text(
    args: string[],
    timeoutMs: number,
    options: { rejectOnNonZero?: boolean; signal?: AbortSignal } = {},
  ) {
    const rejectOnNonZero = options.rejectOnNonZero ?? true;
    return this.run(
      args,
      timeoutMs,
      this.config.adbTextOutputMaxBytes,
      options.signal,
    ).then(({ stdout, stderr, exitCode }) => {
      const result = {
        stdout: this.toString(stdout),
        stderr: this.toString(stderr),
        exitCode,
      };
      if (rejectOnNonZero && exitCode !== 0) {
        throw this.failure(
          `failed with exit code ${exitCode}: ${result.stderr || result.stdout}`,
        );
      }
      return result;
    });
  }

  buffer(args: string[], timeoutMs: number, signal?: AbortSignal) {
    return this.run(
      args,
      timeoutMs,
      this.config.adbBinaryOutputMaxBytes,
      signal,
    ).then(({ stdout, stderr, exitCode }) => {
      const output = this.toBuffer(stdout);
      if (exitCode !== 0) {
        throw this.failure(
          `failed with exit code ${exitCode}: ${this.toString(stderr) || output.toString("utf8")}`,
        );
      }
      if (stdout.truncatedBytes > 0) {
        throw this.failure(
          `produced more than ${this.config.adbBinaryOutputMaxBytes} bytes of output.`,
        );
      }
      return output;
    });
  }

  private run(
    args: string[],
    timeoutMs: number,
    stdoutLimit: number,
    signal?: AbortSignal,
  ) {
    return new Promise<{
      stdout: BoundedOutput;
      stderr: BoundedOutput;
      exitCode: number;
    }>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.failure("was cancelled."));
        return;
      }
      const child = this.spawn(args);
      const stdout = this.output();
      const stderr = this.output();
      let termination: "timeout" | "cancelled" | null = null;
      const terminate = (reason: "timeout" | "cancelled") => {
        termination = reason;
        child.kill("SIGTERM");
      };
      const timer = setTimeout(() => terminate("timeout"), timeoutMs);
      const cancel = () => terminate("cancelled");
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
      };
      signal?.addEventListener("abort", cancel, { once: true });

      child.stdout.on("data", (chunk: Buffer) =>
        this.push(stdout, chunk, stdoutLimit),
      );
      child.stderr.on("data", (chunk: Buffer) =>
        this.push(stderr, chunk, this.config.adbTextOutputMaxBytes),
      );
      child.on("error", () => {
        cleanup();
        reject(this.failure("could not be started."));
      });
      child.on("close", (code) => {
        cleanup();
        if (termination) {
          const detail =
            termination === "timeout"
              ? `timed out after ${timeoutMs}ms.`
              : "was cancelled.";
          reject(this.failure(detail));
          return;
        }
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
    });
  }

  private output(): BoundedOutput {
    return { chunks: [], byteLength: 0, truncatedBytes: 0 };
  }

  private push(output: BoundedOutput, chunk: Buffer, limit: number) {
    const remaining = limit - output.byteLength;
    if (remaining <= 0) {
      output.truncatedBytes += chunk.byteLength;
      return;
    }
    const accepted = chunk.subarray(0, remaining);
    output.chunks.push(accepted);
    output.byteLength += accepted.byteLength;
    output.truncatedBytes += chunk.byteLength - accepted.byteLength;
  }

  private toBuffer(output: BoundedOutput) {
    return Buffer.concat(output.chunks, output.byteLength);
  }

  private toString(output: BoundedOutput) {
    const text = this.toBuffer(output).toString("utf8");
    return output.truncatedBytes
      ? `${text}\n[truncated ${output.truncatedBytes} bytes]`
      : text;
  }

  private failure(detail: string) {
    return new InternalServerErrorException(`adb command ${detail}`);
  }
}
