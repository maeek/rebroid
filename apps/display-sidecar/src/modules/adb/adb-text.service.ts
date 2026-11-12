import { setTimeout as delay } from "node:timers/promises";
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AdbService } from "./adb.service";
import {
  findUiTextTarget,
  hasCompleteUiHierarchy,
  type UiTextMatch,
} from "@rebroid/android-application-core/ui-text";

interface UiTextInput {
  text: string;
  match: UiTextMatch;
  operation: "wait" | "tap";
  timeoutMs: number;
  intervalMs: number;
  operationId?: string;
}

const cancelRetentionMs = 122_000;
const canceledRequestLimit = 1_024;

@Injectable()
export class AdbTextService {
  private readonly pending = new Map<string, AbortController>();
  private readonly canceled = new Map<string, number>();

  constructor(private readonly adb: AdbService) {}

  async tapOnce(udid: string, text: string) {
    const { target } = await this.find(udid, text, "exact");
    if (!target) return { found: false, x: null, y: null };
    await this.adb.tap(udid, target.x, target.y);
    return { found: true, ...target };
  }

  private async find(
    udid: string,
    text: string,
    match: UiTextMatch,
    signal?: AbortSignal,
  ) {
    const dump = await this.adb.dumpUi(udid, signal);
    return dump.status === "available" &&
      dump.xml &&
      hasCompleteUiHierarchy(dump.xml)
      ? { available: true, target: findUiTextTarget(dump.xml, text, match) }
      : { available: false, target: null };
  }

  async poll(udid: string, input: UiTextInput, disconnected: AbortSignal) {
    if (!input.operationId) return this.pollText(udid, input, disconnected);
    const key = `${udid}/${input.operationId}`;
    this.pruneCanceled();
    if (this.canceled.has(key)) {
      throw new ConflictException("UI text operation was canceled.");
    }
    if (this.pending.has(key)) {
      throw new ConflictException("UI text operation is already running.");
    }
    const controller = new AbortController();
    this.pending.set(key, controller);
    try {
      return await this.pollText(
        udid,
        input,
        AbortSignal.any([disconnected, controller.signal]),
      );
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ConflictException("UI text operation was canceled.");
      }
      throw error;
    } finally {
      this.pending.delete(key);
    }
  }

  cancel(udid: string, operationId: string) {
    const key = `${udid}/${operationId}`;
    const running = this.pending.get(key);
    if (running) {
      running.abort();
      return;
    }
    // A cancellation request can reach the sidecar before the tap request.
    this.pruneCanceled();
    if (this.canceled.has(key)) return;
    if (this.canceled.size >= canceledRequestLimit) {
      throw new ServiceUnavailableException(
        "Too many pending UI text cancellations.",
      );
    }
    this.canceled.set(key, performance.now() + cancelRetentionMs);
  }

  private pruneCanceled() {
    const now = performance.now();
    for (const [key, expires] of this.canceled) {
      if (expires > now) break;
      this.canceled.delete(key);
    }
  }

  private async pollText(
    udid: string,
    input: UiTextInput,
    disconnected: AbortSignal,
  ) {
    const deadline = performance.now() + input.timeoutMs;
    const timeout = AbortSignal.timeout(input.timeoutMs);
    const signal = AbortSignal.any([disconnected, timeout]);
    let observed = false;
    let tapping = false;
    try {
      while (performance.now() < deadline) {
        signal.throwIfAborted();
        const { available, target } = await this.find(
          udid,
          input.text,
          input.match,
          signal,
        );
        observed ||= available;
        signal.throwIfAborted();
        if (performance.now() >= deadline) break;
        if (target) {
          if (input.operation === "tap") {
            tapping = true;
            await this.adb.tap(udid, target.x, target.y, signal);
            signal.throwIfAborted();
            if (performance.now() >= deadline) break;
          }
          return { status: "found" as const, ...target };
        }
        const remaining = Math.ceil(deadline - performance.now());
        if (remaining <= 0) break;
        await delay(Math.min(input.intervalMs, remaining), undefined, {
          signal,
        });
        if (remaining <= input.intervalMs) break;
      }
    } catch (error) {
      disconnected.throwIfAborted();
      if (!timeout.aborted && !tapping) throw error;
    }
    if (tapping) return { status: "tap_outcome_unknown" as const };
    return {
      status: observed
        ? ("not_found" as const)
        : ("hierarchy_unavailable" as const),
    };
  }
}
