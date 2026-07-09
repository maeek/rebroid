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
