import { ConflictException, Injectable } from "@nestjs/common";
import { AdbCommandRunner } from "../adb/adb-command-runner";
import { AdbService } from "../adb/adb.service";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { requestAdb } from "./adb-server-socket";
import { attachmentAdbHost } from "./attachment-adb-client";
import { ExternalAdbAttachments } from "./external-adb-attachments";
import { attachmentRequestSignal } from "./attachment-request-signal";

@Injectable()
export class ExternalDisplayAdbRunner extends AdbCommandRunner {
  constructor(
    config: SidecarConfigService,
    private readonly attachments: ExternalAdbAttachments,
  ) {
    super(config);
  }

  override spawn(args: string[]) {
    const [selection, attachmentId, ...command] = args;
    if (selection !== "-s" || !attachmentId || !command.length) {
      throw new ConflictException("A verified attachment is required.");
    }
    const target = this.attachments.requireVerified(attachmentId);
    const request = attachmentRequestSignal.getStore();
    const signal = request
      ? AbortSignal.any([target.signal, request])
      : target.signal;
    signal.throwIfAborted();
    const child = super.spawn([
      "-H",
      attachmentAdbHost,
      "-P",
      String(target.port),
      "-t",
      target.transportId,
      ...command,
    ]);
    const retire = () => child.kill("SIGKILL");
    signal.addEventListener("abort", retire, { once: true });
    child.once("close", () => signal.removeEventListener("abort", retire));
    return child;
  }
}

@Injectable()
export class ExternalDisplayAdb extends AdbService {
  private readonly releaseForward = new Map<number, () => void>();

  constructor(
    private readonly externalRunner: ExternalDisplayAdbRunner,
    private readonly attachments: ExternalAdbAttachments,
  ) {
    super(externalRunner);
  }

  override async ensureConnected(attachmentId: string) {
    const state = await this.getState(attachmentId, 3_000);
    if (state.stdout.trim() !== "device") {
      throw new ConflictException("The verified attachment is offline.");
    }
    return state;
  }

  override ensureViewerConnected(attachmentId: string) {
    return this.ensureConnected(attachmentId);
  }

  override async forward(attachmentId: string, port: number, remote: string) {
    const target = this.attachments.requireVerified(attachmentId);
    const cleanup = () => {
      this.releaseForward.delete(port);
      void requestAdb(
        target.socket,
        [`host-transport-id:${target.transportId}:killforward:tcp:${port}`],
        "status",
      ).catch(() => undefined);
    };
    const release = () => target.signal.removeEventListener("abort", cleanup);
    target.signal.addEventListener("abort", cleanup, { once: true });
    this.releaseForward.set(port, release);
    try {
      return await this.externalRunner.text(
        ["-s", attachmentId, "forward", "--no-rebind", `tcp:${port}`, remote],
        5_000,
      );
    } catch (error) {
      release();
      if (this.releaseForward.get(port) === release)
        this.releaseForward.delete(port);
      throw error;
    }
  }

  override async removeForward(attachmentId: string, port: number) {
    const release = this.releaseForward.get(port);
    const result = await super.removeForward(attachmentId, port);
    if (this.releaseForward.get(port) === release)
      this.releaseForward.delete(port);
    release?.();
    return result;
  }
}
