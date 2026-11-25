import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { requestAdb } from "./adb-server-socket";

const runFile = promisify(execFile);

export interface AdbDaemon {
  socket: string;
  child: ChildProcess;
  alive: boolean;
  relayPorts: Set<number>;
}

@Injectable()
export class ExternalAdbDaemon implements OnModuleDestroy {
  private pending?: Promise<AdbDaemon>;
  private current?: AdbDaemon;
  private stopping = false;

  constructor(private readonly config: SidecarConfigService) {}

  open() {
    if (this.stopping) throw new Error("ADB is shutting down.");
    if (this.current?.alive) return Promise.resolve(this.current);
    return (this.pending ??= this.start().finally(() => {
      this.pending = undefined;
    }));
  }

  async fingerprint() {
    const path = join(
      this.config.externalAdbKeysDirectory,
      ".android",
      "adbkey.pub",
    );
    const key = (await readFile(path, "utf8")).split(/\s+/)[0];
    return (
      createHash("md5")
        .update(Buffer.from(key, "base64"))
        .digest("hex")
        .toUpperCase()
        .match(/../g)
        ?.join(":") ?? null
    );
  }

  async readiness() {
    const [adb, keyStorage, usb] = await Promise.all([
      runFile(this.config.adbPath, ["version"], {
        timeout: 750,
        maxBuffer: 4096,
      }).then(
        () => true,
        () => false,
      ),
      this.prepareKeys().then(
        () => true,
        () => false,
      ),
      this.config.externalAdbUsbPorts.size === 0
        ? ("not_configured" as const)
        : readdir("/dev/bus/usb").then(
            (buses) =>
              buses.length > 0
                ? ("configured" as const)
                : ("unavailable" as const),
            () => "unavailable" as const,
          ),
    ]);
    return { adb, keyStorage, usb };
  }

  private async prepareKeys() {
    const keys = this.config.externalAdbKeysDirectory;
    await mkdir(keys, { recursive: true, mode: 0o700 });
    await chmod(keys, 0o700);
    await access(keys, constants.R_OK | constants.W_OK | constants.X_OK);
    return keys;
  }

  private async start() {
    const keys = await this.prepareKeys();
    const directory = await mkdtemp(join(tmpdir(), "rebroid-ext-adb-"));
    const socket = join(directory, "server");
    const child = spawn(
      this.config.adbPath,
      ["-L", `localfilesystem:${socket}`, "nodaemon", "server"],
      {
        stdio: "ignore",
        env: {
          PATH: process.env.PATH,
          // Debian's packaged adb looks under HOME for its host key.
          HOME: keys,
          ANDROID_SDK_HOME: keys,
          ANDROID_USER_HOME: join(keys, ".android"),
          ADB_LIBUSB: "0",
          ADB_LOCAL_TRANSPORT_MAX_PORT: "0",
          ADB_MDNS_AUTO_CONNECT: "0",
        },
      },
    );
    const daemon = {
      socket,
      child,
      alive: true,
      relayPorts: new Set<number>(),
    };
    const retire = () => {
      daemon.alive = false;
      if (daemon === this.current) this.current = undefined;
      void rm(directory, { force: true, recursive: true }).catch(() => {});
    };
    child.once("error", retire);
    child.once("exit", retire);
    try {
      for (
        let attempt = 0;
        attempt < 30 && daemon.alive && !this.stopping;
        attempt += 1
      ) {
        if ((await stat(socket).catch(() => null))?.isSocket()) {
          await requestAdb(socket, ["host:version"], "length");
          if (!daemon.alive || this.stopping) break;
          this.current = daemon;
          return daemon;
        }
        await delay(50);
      }
      throw new Error("External ADB server could not start.");
    } catch (error) {
      child.kill();
      retire();
      throw error;
    }
  }

  onModuleDestroy() {
    this.stopping = true;
    this.current?.child.kill();
  }
}
