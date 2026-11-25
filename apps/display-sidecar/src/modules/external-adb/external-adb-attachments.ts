import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  externalDeviceChallengePath,
  isExternalAdbTcpEndpoint,
  type ExternalDeviceConnection,
  type ExternalDeviceFailure,
  type ExternalDeviceTransport,
  type ExternalAdbTcpCheckStatus,
} from "@rebroid/android-application-core/android-device";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { BlockList } from "node:net";
import { networkInterfaces } from "node:os";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { parseAdbInventory, type AdbTransport } from "./adb-inventory";
import { requestAdb } from "./adb-server-socket";
import { openAttachmentAdbClient } from "./attachment-adb-client";
import { ExternalAdbDaemon, type AdbDaemon } from "./external-adb-daemon";
import { openTcpAttachmentRelay } from "./tcp-attachment-relay";
import { checkTcpPort } from "./tcp-port-check";

const verificationWindowMs = 120_000;
const observationWindowMs = 60_000;
const maximumAttempts = 64;
const maximumTcpChecks = 8;

interface Candidate {
  selector: string;
  expires: number;
}

interface RetiredAttempt {
  deviceId: string;
  expires: number;
  connection: ExternalDeviceConnection;
  cleanup?: Promise<void>;
}

interface Attempt {
  deviceId: string;
  transport: ExternalDeviceTransport;
  selector: string;
  expires: number;
  monitorBy: number;
  connection: ExternalDeviceConnection;
  challenge: string;
  sawUnauthorized: boolean;
  usbReplug?: { port: string; transportId: string; unplugged: boolean };
  sawUsbReplug?: boolean;
  daemon?: AdbDaemon;
  serial?: string;
  transportId?: string;
  stop?: () => void;
  close?: () => void;
  client?: Awaited<ReturnType<typeof openAttachmentAdbClient>>;
  retirement?: AbortController;
}

@Injectable()
export class ExternalAdbAttachments implements OnModuleDestroy {
  private readonly candidates = new Map<string, Candidate>();
  private readonly attempts = new Map<string, Attempt>();
  private readonly retired = new Map<string, RetiredAttempt>();
  private readonly clientPorts = new Set<number>();
  private readonly verified = new Map<string, Attempt>();
  private readonly tcpChecks = new Map<
    string,
    Promise<ExternalAdbTcpCheckStatus>
  >();
  private readonly retirementListeners = new Set<(id: string) => void>();
  private observing = false;
  private readonly timer = setInterval(() => {
    if (!this.observing && this.attempts.size) void this.observe();
  }, 1000).unref();

  constructor(
    private readonly config: SidecarConfigService,
    private readonly daemon: ExternalAdbDaemon,
    private readonly features: SidecarFeatureService,
  ) {}

  assertEnabled() {
    if (!this.features.isExternalAdbEnabled() || !this.config.hasSharedSecret) {
      throw new ForbiddenException("External ADB is disabled.");
    }
  }

  async listCandidates() {
    this.assertEnabled();
    const daemon = await this.daemon.open();
    const inventory = await this.inventory(daemon);
    const rows = inventory
      .filter((row) => this.eligibleUsb(row))
      .slice(0, maximumAttempts);
    this.expireTokens();
    const expires = Date.now() + 60_000;
    return rows.map((row) => {
      const candidateId = randomUUID();
      const label =
        row.model?.replaceAll("_", " ") ?? `USB port ${row.usbPath}`;
      this.candidates.set(candidateId, {
        selector: this.selector(row),
        expires,
      });
      if (this.candidates.size > 256) {
        const oldest = this.candidates.keys().next().value;
        if (oldest) this.candidates.delete(oldest);
      }
      return { candidateId, label, state: row.state };
    });
  }

  resolveCandidate(id: string) {
    this.assertEnabled();
    const candidate = this.candidates.get(id);
    if (!candidate || candidate.expires <= Date.now())
      throw new ConflictException("USB selection expired.");
    return { selector: candidate.selector };
  }

  async checkTcpEndpoint(
    endpoint: string,
  ): Promise<{ status: ExternalAdbTcpCheckStatus }> {
    this.assertEnabled();
    if (!this.allowedTcp(endpoint)) return { status: "not_allowed" };

    const existing = this.tcpChecks.get(endpoint);
    if (existing) return { status: await existing };
    if (this.tcpChecks.size >= maximumTcpChecks) {
      throw new ServiceUnavailableException(
        "The broker is busy checking connections.",
      );
    }
    const [host, port] = endpoint.split(":");
    const check = checkTcpPort(host, Number(port));
    this.tcpChecks.set(endpoint, check);
    try {
      return { status: await check };
    } finally {
      this.tcpChecks.delete(endpoint);
    }
  }

  async connect(
    deviceId: string,
    attemptId: string,
    transport: ExternalDeviceTransport,
    selector: string,
  ) {
    this.assertEnabled();
    this.expireTokens();
    if (this.retired.has(attemptId))
      throw new ConflictException("Connection attempt expired.");
    const prior = this.attempts.get(attemptId);
    if (prior) {
      if (
        prior.deviceId !== deviceId ||
        prior.selector !== selector ||
        prior.transport !== transport
      ) {
        throw new ConflictException("Connection attempt changed.");
      }
      return prior.connection;
    }
    if (
      this.attempts.size >= maximumAttempts ||
      [...this.attempts.values()].some(
        (row) =>
          row.deviceId === deviceId ||
          (row.selector === selector && row.transport === transport),
      )
    )
      throw new ConflictException(
        "External ADB attachment is already reserved.",
      );
    if (transport === "tcp" && !this.allowedTcp(selector)) {
      throw new ForbiddenException(
        "TCP endpoint is outside the configured device list.",
      );
    }

    const row: Attempt = {
      deviceId,
      transport,
      selector,
      expires: Date.now() + verificationWindowMs,
      monitorBy: Date.now() + observationWindowMs,
      challenge: randomBytes(16).toString("hex"),
      sawUnauthorized: false,
      connection: {
        state: "connecting",
        failure: null,
        attemptId,
        attachmentId: null,
        observedAt: new Date().toISOString(),
      },
    };
    this.attempts.set(attemptId, row);
    try {
      const daemon = await this.daemon.open();
      if (!this.current(row)) return row.connection;
      row.daemon = daemon;
      if (transport === "tcp") {
        const [host, port] = selector.split(":");
        const relay = await openTcpAttachmentRelay(
          host,
          Number(port),
          daemon.relayPorts,
          () => this.lose(row, "transport_unavailable"),
        );
        if (!this.current(row)) {
          relay.close();
          return row.connection;
        }
        row.serial = relay.endpoint;
        row.stop = relay.stop;
        row.close = relay.close;
        await requestAdb(
          daemon.socket,
          [`host:connect:${relay.endpoint}`],
          "length",
        );
      }
      if (this.current(row))
        this.applyInventory(row, await this.inventory(daemon));
    } catch {
      this.lose(row, "transport_unavailable");
    }
    return row.connection;
  }

  async inspect(deviceId: string, attemptId: string) {
    this.assertEnabled();
    const row = this.attempts.get(attemptId);
    if (row?.deviceId !== deviceId) {
      const retired = this.retired.get(attemptId);
      if (retired?.deviceId === deviceId) return retired.connection;
      return {
        state: "offline",
        failure: "transport_unavailable",
        attemptId,
        attachmentId: null,
        observedAt: new Date().toISOString(),
      } satisfies ExternalDeviceConnection;
    }
    if (row.monitorBy <= Date.now()) this.lose(row, "broker_unavailable");
    else if (row.daemon) {
      const inventory = await this.inventory(row.daemon).catch(() => null);
      if (inventory) this.applyInventory(row, inventory);
      else this.lose(row, "broker_unavailable");
      if (this.current(row)) row.monitorBy = Date.now() + observationWindowMs;
    }
    return row.connection;
  }

  async instructions(deviceId: string, attemptId: string) {
    this.assertEnabled();
    const row = this.requireAttempt(deviceId, attemptId);
    return {
      challenge: row.transport === "tcp" ? row.challenge : null,
      fingerprint: await this.daemon.fingerprint().catch(() => null),
      androidPromptObserved: row.sawUnauthorized,
    };
  }

  async verify(
    deviceId: string,
    attemptId: string,
    proof: "physical" | "challenge" | "android_prompt",
  ) {
    this.assertEnabled();
    const row = this.requireAttempt(deviceId, attemptId);
    if (!row.daemon?.alive || !row.transportId)
      throw new ConflictException("Android transport is unavailable.");
    this.applyInventory(row, await this.inventory(row.daemon));
    if (row.connection.state === "ready") return row.connection;
    if (row.connection.state !== "awaiting_verification")
      throw new ConflictException("Android transport is unavailable.");
    let verified =
      row.transport === "usb" &&
      proof === "physical" &&
      (row.sawUnauthorized || row.sawUsbReplug === true);
    if (row.transport === "tcp" && proof === "android_prompt")
      verified = row.sawUnauthorized;
    if (row.transport === "tcp" && proof === "challenge") {
      const value = await requestAdb(
        row.daemon.socket,
        [
          `host:transport-id:${row.transportId}`,
          `shell:cat ${externalDeviceChallengePath}`,
        ],
        "stream",
      ).catch(() => "");
      verified = value.trim() === row.challenge;
    }
    if (!verified || !this.current(row) || !row.daemon.alive)
      throw new ConflictException("Device verification did not match.");
    this.applyInventory(row, await this.inventory(row.daemon));
    if (
      !this.current(row) ||
      row.connection.state !== "awaiting_verification"
    ) {
      throw new ConflictException("Device disconnected during verification.");
    }
    const client = await openAttachmentAdbClient(
      row.daemon.socket,
      this.clientPorts,
    );
    if (
      !this.current(row) ||
      !row.daemon.alive ||
      row.connection.state !== "awaiting_verification"
    ) {
      client.close();
      throw new ConflictException("Device disconnected during verification.");
    }
    row.client = client;
    row.retirement = new AbortController();
    row.expires = Date.now() + 60 * 60_000;
    row.connection = {
      ...row.connection,
      state: "ready",
      attachmentId: randomUUID(),
    };
    this.verified.set(row.connection.attachmentId!, row);
    return row.connection;
  }

  requireVerified(attachmentId: string, deviceId?: string) {
    this.assertEnabled();
    const row = this.verified.get(attachmentId);
    if (
      row &&
      (!row.daemon?.alive || Math.min(row.expires, row.monitorBy) <= Date.now())
    ) {
      this.lose(row, "transport_unavailable");
    }
    if (
      !row?.client ||
      !row.transportId ||
      !row.retirement ||
      row.retirement.signal.aborted ||
      (deviceId !== undefined && deviceId !== row.deviceId)
    ) {
      throw new ConflictException("Verified device attachment is unavailable.");
    }
    return {
      port: row.client.port,
      transportId: row.transportId,
      socket: row.daemon!.socket,
      signal: row.retirement.signal,
    };
  }

  onRetired(listener: (id: string) => void) {
    this.retirementListeners.add(listener);
    return () => this.retirementListeners.delete(listener);
  }

  async detach(deviceId: string, attemptId: string) {
    // Retirement still works when enrollment is disabled.
    if (!this.config.hasSharedSecret) throw new ForbiddenException();
    const row = this.attempts.get(attemptId);
    if (row && row.deviceId !== deviceId)
      throw new ConflictException("Connection attempt changed.");
    this.expireTokens();
    if (row) this.lose(row, "transport_unavailable");
    const retired = this.retired.get(attemptId);
    if (retired && retired.deviceId !== deviceId)
      throw new ConflictException("Connection attempt changed.");
    if (!retired)
      this.rememberRetired(deviceId, attemptId, "transport_unavailable");
    await retired?.cleanup;
    return { detached: true as const };
  }

  private async observe() {
    this.observing = true;
    try {
      const rows = [...this.attempts.values()];
      if (!this.features.isExternalAdbEnabled()) {
        for (const row of rows) this.lose(row, "verification_required");
        return;
      }
      const daemons = new Set(
        rows.flatMap((row) => (row.daemon ? [row.daemon] : [])),
      );
      for (const daemon of daemons) {
        const result = await this.inventory(daemon).catch(() => null);
        for (const row of rows) {
          if (row.daemon !== daemon || !this.current(row)) continue;
          if (result) this.applyInventory(row, result);
          else this.lose(row, "broker_unavailable");
        }
      }
      for (const row of rows) {
        if (!this.current(row)) continue;
        if (row.monitorBy <= Date.now()) this.lose(row, "broker_unavailable");
        else if (row.expires <= Date.now()) this.lose(row, "attempt_expired");
      }
    } finally {
      this.observing = false;
    }
  }

  private applyInventory(row: Attempt, inventory: AdbTransport[]) {
    if (!this.current(row)) return;
    if (!row.daemon?.alive) return this.lose(row, "broker_unavailable");
    if (row.monitorBy <= Date.now())
      return this.lose(row, "broker_unavailable");
    if (row.expires <= Date.now()) return this.lose(row, "attempt_expired");
    const candidates = inventory.filter((target) =>
      row.transport === "tcp"
        ? target.serial === row.serial && !target.usbPath
        : this.eligibleUsb(target) && this.selector(target) === row.selector,
    );
    const target = candidates.length === 1 ? candidates[0] : undefined;
    if (row.usbReplug) {
      const replug = row.usbReplug;
      const onPort = inventory.filter(
        (device) => device.usbPath === replug.port,
      );
      if (onPort.length === 0) {
        replug.unplugged = true;
        return;
      }
      if (!target || onPort.length !== 1)
        return this.lose(row, "transport_unavailable");
      if (target.id === replug.transportId) {
        if (replug.unplugged) this.lose(row, "transport_unavailable");
        return;
      }
      if (!replug.unplugged) return this.lose(row, "transport_unavailable");
      row.sawUsbReplug = true;
      row.usbReplug = undefined;
      row.transportId = undefined;
    }
    if (!target && !row.transportId && row.transport === "tcp") return;
    if (!target || (row.transportId && row.transportId !== target.id))
      return this.lose(row, "transport_unavailable");
    if (inventory.some((item) => item.id === target.id && item !== target))
      return this.lose(row, "transport_unavailable");
    if (
      [...this.attempts.values()].some(
        (other) =>
          other !== row &&
          other.daemon === row.daemon &&
          other.transportId === target.id,
      )
    ) {
      return this.lose(row, "transport_unavailable");
    }
    if (row.connection.state === "ready" && target.state !== "device")
      return this.lose(row, "transport_unavailable");
    if (
      target.state === "offline" &&
      row.transportId &&
      row.connection.state !== "connecting"
    ) {
      return this.lose(row, "transport_unavailable");
    }
    row.transportId = target.id;
    row.sawUnauthorized ||= target.state === "unauthorized";
    let state: ExternalDeviceConnection["state"] = "connecting";
    if (target.state === "unauthorized") state = "awaiting_android_approval";
    if (target.state === "device")
      state =
        row.connection.state === "ready" ? "ready" : "awaiting_verification";
    if (
      state === "awaiting_verification" &&
      row.transport === "usb" &&
      target.usbPath &&
      !row.sawUnauthorized &&
      !row.sawUsbReplug
    ) {
      row.usbReplug = {
        port: target.usbPath,
        transportId: target.id,
        unplugged: false,
      };
      state = "awaiting_usb_replug";
    }
    row.connection = {
      ...row.connection,
      state,
      observedAt: new Date().toISOString(),
    };
  }

  private inventory(daemon: AdbDaemon) {
    if (!daemon.alive) return Promise.reject(new Error("ADB server exited."));
    return requestAdb(daemon.socket, ["host:devices-l"], "length").then(
      parseAdbInventory,
    );
  }

  private requireAttempt(deviceId: string, attemptId: string) {
    const row = this.attempts.get(attemptId);
    if (
      !row ||
      row.deviceId !== deviceId ||
      row.expires <= Date.now() ||
      row.monitorBy <= Date.now()
    )
      throw new ConflictException("Connection attempt expired.");
    return row;
  }

  private current(row: Attempt) {
    return this.attempts.get(row.connection.attemptId!) === row;
  }

  private lose(row: Attempt, failure: ExternalDeviceFailure) {
    if (!this.current(row)) return;
    const attemptId = row.connection.attemptId!;
    this.attempts.delete(attemptId);
    const attachmentId = row.connection.attachmentId;
    if (attachmentId) this.verified.delete(attachmentId);
    row.retirement?.abort();
    row.client?.close();
    if (attachmentId) {
      for (const listener of this.retirementListeners) listener(attachmentId);
    }
    const retired = this.rememberRetired(row.deviceId, attemptId, failure);
    row.connection = retired.connection;
    row.stop?.();
    if (row.daemon && row.serial && row.close) {
      const { daemon, serial, close } = row;
      retired.cleanup = this.releaseTcpRelay(daemon, serial, close);
    } else {
      row.close?.();
    }
  }

  private rememberRetired(
    deviceId: string,
    attemptId: string,
    failure: ExternalDeviceFailure,
  ) {
    const connection: ExternalDeviceConnection = {
      state: "offline",
      failure,
      attemptId,
      attachmentId: null,
      observedAt: new Date().toISOString(),
    };
    const retired: RetiredAttempt = {
      deviceId,
      expires: Date.now() + verificationWindowMs,
      connection,
    };
    this.retired.set(attemptId, retired);
    return retired;
  }

  private async releaseTcpRelay(
    daemon: AdbDaemon,
    serial: string,
    close: () => void,
  ) {
    if (!daemon.alive) return close();
    try {
      await requestAdb(daemon.socket, [`host:disconnect:${serial}`], "length");
      close();
    } catch {
      // ADB can still retry this local port. Hold it until this daemon exits.
      if (!daemon.alive) return close();
      daemon.child.once("exit", close);
    }
  }

  private allowedTcp(selector: string) {
    if (
      !isExternalAdbTcpEndpoint(selector) ||
      !this.config.externalAdbTcpEndpoints.has(selector)
    )
      return false;

    // The broker's directly attached network contains internal services.
    const internal = new BlockList();
    for (const group of Object.values(networkInterfaces())) {
      for (const address of group ?? []) {
        if (address.family !== "IPv4" || !address.cidr) continue;
        const prefix = Number(address.cidr.split("/")[1]);
        internal.addSubnet(address.address, prefix, "ipv4");
      }
    }
    return !internal.check(selector.split(":")[0], "ipv4");
  }

  private eligibleUsb(row: AdbTransport) {
    return (
      !!row.usbPath &&
      this.config.externalAdbUsbPorts.has(row.usbPath) &&
      /^[\w.-]{1,128}$/.test(row.serial)
    );
  }

  private selector(row: AdbTransport) {
    return createHmac("sha256", this.config.sharedSecret)
      .update(`${row.usbPath}\0${row.serial}`)
      .digest("hex");
  }

  private expireTokens() {
    for (const [id, attempt] of this.retired)
      if (attempt.expires <= Date.now()) this.retired.delete(id);
    for (const [id, candidate] of this.candidates)
      if (candidate.expires <= Date.now()) this.candidates.delete(id);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    for (const row of this.attempts.values())
      this.lose(row, "broker_unavailable");
  }
}
