import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FirewallAdapter } from "./firewall";
import { FirewallPolicyStore } from "./policy-store";
import { createFirewallAgentServer } from "./server";

const adapter: FirewallAdapter = {
  name: "test",
  initialize() {},
  apply() {},
  remove() {},
  reconcile() {},
};

test("server rejects unauthorized and oversized policy requests", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const server = createFirewallAgentServer({
    secret: "secret",
    adapter,
    store: new FirewallPolicyStore(join(directory, "policies.json")),
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/reconcile`, {
      method: "PUT",
      body: "{}",
    });
    assert.equal(unauthorized.status, 401);

    const oversized = await fetch(`http://127.0.0.1:${port}/v1/reconcile`, {
      method: "PUT",
      headers: { "x-firewall-agent-secret": "secret" },
      body: JSON.stringify({ padding: "x".repeat(129 * 1024) }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});

test("server reports invalid bodies and adapter failures distinctly", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const failingAdapter: FirewallAdapter = {
    ...adapter,
    apply() {
      throw new Error("iptables failed");
    },
  };
  const server = createFirewallAgentServer({
    secret: "secret",
    adapter: failingAdapter,
    store: new FirewallPolicyStore(join(directory, "policies.json")),
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const invalid = await fetch(`http://127.0.0.1:${port}/v1/reconcile`, {
      method: "PUT",
      headers: { "x-firewall-agent-secret": "secret" },
      body: "not-json",
    });
    assert.equal(invalid.status, 400);

    const failed = await fetch(`http://127.0.0.1:${port}/v1/policies/app-1`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-firewall-agent-secret": "secret",
      },
      body: JSON.stringify({
        applicationId: "app-1",
        containerId: "container-1",
        containerIp: "10.0.0.2",
        enabled: true,
        allowCidrs: ["10.0.0.0/8"],
        generation: 1,
      }),
    });
    assert.equal(failed.status, 500);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});

test("removing a stale runtime policy preserves the replacement policy", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const store = new FirewallPolicyStore(join(directory, "policies.json"));
  let removals = 0;
  const server = createFirewallAgentServer({
    secret: "secret",
    adapter: {
      ...adapter,
      remove: () => {
        removals += 1;
      },
    },
    store,
  });
  try {
    store.set({
      applicationId: "app-1",
      containerId: "new-runtime",
      containerIp: "10.0.0.2",
      enabled: true,
      allowCidrs: [],
      generation: 1,
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const remove = (containerId: string) =>
      fetch(
        `http://127.0.0.1:${port}/v1/policies/app-1?containerId=${containerId}`,
        {
          method: "DELETE",
          headers: { "x-firewall-agent-secret": "secret" },
        },
      );

    assert.equal((await remove("old-runtime")).status, 200);
    assert.equal(store.get("app-1")?.containerId, "new-runtime");
    assert.equal(removals, 0);

    assert.equal((await remove("new-runtime")).status, 200);
    assert.equal(store.get("app-1"), undefined);
    assert.equal(removals, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reconciliation preserves an in-flight startup guard and a policy newer than its snapshot", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const store = new FirewallPolicyStore(join(directory, "policies.json"));
  const server = createFirewallAgentServer({
    secret: "secret",
    adapter,
    store,
  });
  const runtimePolicy = {
    applicationId: "app-1",
    containerId: "container-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 2,
  };
  try {
    store.set(runtimePolicy);
    store.set({
      ...runtimePolicy,
      applicationId: "startup-app-1",
      containerIp: "10.0.0.0/24",
      startup: true,
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const reconcile = (startedAt: number) =>
      fetch(`http://127.0.0.1:${port}/v1/reconcile`, {
        method: "PUT",
        headers: { "x-firewall-agent-secret": "secret" },
        body: JSON.stringify({ policies: [], startedAt }),
      });

    assert.equal((await reconcile(3)).status, 200);
    assert.equal(store.get("startup-app-1")?.startup, true);
    assert.deepEqual(store.get("app-1"), runtimePolicy);
    store.delete("startup-app-1");
    assert.equal((await reconcile(1)).status, 200);
    assert.deepEqual(store.get("app-1"), runtimePolicy);
    assert.equal((await reconcile(3)).status, 200);
    assert.equal(store.get("app-1"), undefined);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});
