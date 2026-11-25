import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SidecarConfigService } from "../shared/sidecar-config.service";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { ExternalAdbAttachments } from "./external-adb-attachments";
import { attachmentAdbHost } from "./attachment-adb-client";
import type { AdbDaemon, ExternalAdbDaemon } from "./external-adb-daemon";
import { openTcpAttachmentRelay } from "./tcp-attachment-relay";
import { checkTcpPort } from "./tcp-port-check";

test("TCP reachability checks close the socket without sending ADB data", async () => {
  let bytesRead: number | undefined;
  const server = createServer((socket) => {
    socket.resume();
    socket.once("end", () => {
      bytesRead = socket.bytesRead;
    });
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    assert.equal(
      await checkTcpPort(address.address, address.port),
      "reachable",
    );
  } finally {
    server.close();
    await once(server, "close");
  }
  assert.equal(bytesRead, 0);
  assert.equal(await checkTcpPort(address.address, address.port), "refused");
});

test("USB admission retires the selected transport after replacement or daemon loss", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-adb-test-"));
  const path = join(directory, "adb");
  let inventory =
    "phone-1\tunauthorized usb:1-2 transport_id:7\nother\tdevice usb:1-3 transport_id:8\n";
  const server = createServer((socket) => {
    socket.once("data", (chunk) => {
      assert.equal(chunk.toString().slice(4), "host:devices-l");
      socket.end(
        `OKAY${Buffer.byteLength(inventory).toString(16).padStart(4, "0")}${inventory}`,
      );
    });
  }).listen(path);
  await once(server, "listening");
  const daemon = {
    socket: path,
    alive: true,
    relayPorts: new Set(),
  } as AdbDaemon;
  const config = {
    externalAdbEnabled: true,
    hasSharedSecret: true,
    sharedSecret: "usb-test",
    externalAdbTcpEndpoints: new Set(),
    externalAdbUsbPorts: new Set(["1-2"]),
  } as unknown as SidecarConfigService;
  const features = new SidecarFeatureService(config);
  features.apply({
    revision: 1,
    features: [
      { key: "feature.display-virtual", effective: false },
      { key: "feature.display-webrtc", effective: false },
      { key: "feature.external-devices", effective: true },
    ],
  });
  const attachments = new ExternalAdbAttachments(
    config,
    {
      open: () => Promise.resolve(daemon),
    } as ExternalAdbDaemon,
    features,
  );
  try {
    assert.deepEqual(await attachments.checkTcpEndpoint("192.168.1.20:5555"), {
      status: "not_allowed",
    });
    const candidates = await attachments.listCandidates();
    assert.equal(candidates.length, 1);
    const selector = attachments.resolveCandidate(
      candidates[0].candidateId,
    ).selector;
    assert.match(selector, /^[0-9a-f]{64}$/);
    const id = randomUUID();
    const attempt = randomUUID();
    assert.equal(
      (await attachments.connect(id, attempt, "usb", selector)).state,
      "awaiting_android_approval",
    );
    await assert.rejects(attachments.verify(id, attempt, "physical"));
    inventory = inventory.replace("unauthorized", "device");
    const ready = await attachments.verify(id, attempt, "physical");
    assert.equal(ready.state, "ready");
    assert.ok(ready.attachmentId);
    const target = attachments.requireVerified(ready.attachmentId, id);
    assert.equal(target.transportId, "7");
    assert.throws(() =>
      attachments.requireVerified(ready.attachmentId!, randomUUID()),
    );
    const retired: string[] = [];
    const unsubscribe = attachments.onRetired((attachmentId) =>
      retired.push(attachmentId),
    );
    const client = createConnection(target.port, attachmentAdbHost);
    await once(client, "connect");
    const closed = once(client, "close");
    await assert.rejects(
      attachments.connect(randomUUID(), randomUUID(), "usb", selector),
    );
    inventory = inventory.replace("transport_id:7", "transport_id:9");
    const replaced = await attachments.inspect(id, attempt);
    assert.equal(replaced.failure, "transport_unavailable");
    assert.equal(replaced.attachmentId, null);
    assert.deepEqual(retired, [ready.attachmentId]);
    assert.ok(target.signal.aborted);
    await closed;
    unsubscribe();
    assert.throws(() => attachments.requireVerified(ready.attachmentId!));
    await assert.rejects(attachments.verify(id, attempt, "physical"));
    await assert.rejects(attachments.connect(id, attempt, "usb", selector));

    const nextAttempt = randomUUID();
    assert.equal(
      (await attachments.connect(id, nextAttempt, "usb", selector)).state,
      "awaiting_usb_replug",
    );
    await assert.rejects(attachments.verify(id, nextAttempt, "physical"));
    inventory = "other\tdevice usb:1-3 transport_id:8\n";
    assert.equal(
      (await attachments.inspect(id, nextAttempt)).state,
      "awaiting_usb_replug",
    );
    inventory += "phone-1\tdevice usb:1-2 transport_id:10\n";
    assert.equal(
      (await attachments.inspect(id, nextAttempt)).state,
      "awaiting_verification",
    );
    assert.notEqual(
      (await attachments.verify(id, nextAttempt, "physical")).attachmentId,
      ready.attachmentId,
    );
    daemon.alive = false;
    const lost = await attachments.inspect(id, nextAttempt);
    assert.equal(lost.attachmentId, null);
    assert.equal(lost.failure, "broker_unavailable");
    await attachments.detach(id, nextAttempt);
  } finally {
    attachments.onModuleDestroy();
    server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("a stale TCP reconnect cannot create a second upstream connection", async () => {
  let accepted = 0;
  let first: Socket | undefined;
  const peer = createServer((socket) => {
    accepted += 1;
    first = socket;
    socket.write("peer");
  }).listen(0, "127.0.0.1");
  await once(peer, "listening");
  const address = peer.address();
  assert.ok(address && typeof address !== "string");
  let resolveLoss!: () => void;
  const loss = new Promise<void>((resolve) => {
    resolveLoss = resolve;
  });
  const used = new Set<number>();
  const relay = await openTcpAttachmentRelay(
    "127.0.0.1",
    address.port,
    used,
    resolveLoss,
  );
  const port = Number(relay.endpoint.split(":")[1]);
  try {
    const client = createConnection({ port, host: "127.0.0.1" });
    await once(client, "data");
    first?.destroy();
    await loss;
    const stale = createConnection({ port, host: "127.0.0.1" });
    await once(stale, "close");
    assert.equal(accepted, 1);
  } finally {
    relay.close();
    await new Promise<void>((resolve) => peer.close(() => resolve()));
  }
});
