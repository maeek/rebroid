import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { FirewallAdapter, FirewallPolicy } from "./firewall";
import { FirewallPolicyStore } from "./policy-store";
import { createFirewallAgentServer } from "./server";

const adapter: FirewallAdapter = {
  name: "test",
  initialize() {},
  apply() {},
  remove() {},
  reconcile() {},
};

function requestPolicy(
  server: ReturnType<typeof createFirewallAgentServer>,
  method: string,
  url: string,
  body?: unknown,
) {
  return new Promise<number>((resolve) => {
    const request = Object.assign(new PassThrough(), {
      method,
      url,
      headers: { "x-firewall-agent-secret": "secret" },
    });
    let status = 0;
    const response = {
      writeHead(code: number) {
        status = code;
      },
      end() {
        resolve(status);
      },
    };
    server.emit("request", request, response);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test("a guarded removal fences a stale first write without blocking the replacement", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const statePath = join(directory, "policies.json");
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  context.mock.method(Date, "now", () => 30);
  const path = "/v1/policies/app-1";
  const oldPolicy = {
    applicationId: "app-1",
    containerId: "old",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 20,
  };
  const server = createFirewallAgentServer({
    secret: "secret",
    adapter,
    store: new FirewallPolicyStore(statePath),
  });
  assert.equal(
    await requestPolicy(server, "DELETE", `${path}?containerId=old`),
    200,
  );

  const store = new FirewallPolicyStore(statePath);
  store.load();
  const restarted = createFirewallAgentServer({
    secret: "secret",
    adapter,
    store,
  });
  assert.equal(
    await requestPolicy(restarted, "PUT", "/v1/reconcile", {
      policies: [oldPolicy],
      startedAt: 20,
    }),
    200,
  );
  assert.equal(store.snapshot().policies.size, 0);
  assert.equal(await requestPolicy(restarted, "PUT", path, oldPolicy), 409);
  assert.equal(
    await requestPolicy(restarted, "PUT", path, {
      ...oldPolicy,
      containerId: "replacement",
    }),
    200,
  );
  assert.equal(
    await requestPolicy(restarted, "DELETE", `${path}?containerId=old`),
    200,
  );
  assert.equal(
    store.snapshot().policies.get("app-1")?.containerId,
    "replacement",
  );
});

test("a stale reconciliation cannot restore a deleted policy after restart", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const statePath = join(directory, "policies.json");
  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "container-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 10,
  };
  const installed = new Map<string, FirewallPolicy>();
  const backend: FirewallAdapter = {
    ...adapter,
    apply(next) {
      installed.set(next.applicationId, next);
    },
    remove(id) {
      installed.delete(id);
    },
    reconcile(policies) {
      installed.clear();
      for (const [id, desired] of policies) installed.set(id, desired);
    },
  };
  context.mock.method(Date, "now", () => 30);
  const path = "/v1/policies/app-1";
  try {
    const initial = createFirewallAgentServer({
      secret: "secret",
      adapter: backend,
      store: new FirewallPolicyStore(statePath),
    });
    assert.equal(await requestPolicy(initial, "PUT", path, policy), 200);
    assert.equal(await requestPolicy(initial, "DELETE", path), 200);
    assert.equal(installed.has(policy.applicationId), false);

    const store = new FirewallPolicyStore(statePath);
    backend.reconcile(store.load().policies);
    const restarted = createFirewallAgentServer({
      secret: "secret",
      adapter: backend,
      store,
    });
    assert.equal(
      await requestPolicy(restarted, "PUT", "/v1/reconcile", {
        startedAt: 20,
        policies: [{ ...policy, generation: 40 }],
      }),
      200,
    );
    assert.equal(installed.has(policy.applicationId), false);

    assert.equal(
      await requestPolicy(restarted, "PUT", path, {
        ...policy,
        generation: 20,
      }),
      409,
    );
    assert.equal(
      await requestPolicy(restarted, "PUT", "/v1/reconcile", {
        startedAt: 45,
        policies: [],
      }),
      200,
    );
    const reloaded = new FirewallPolicyStore(statePath);
    assert.equal(reloaded.load().removals.has(policy.applicationId), false);
    const afterPruning = createFirewallAgentServer({
      secret: "secret",
      adapter: backend,
      store: reloaded,
    });
    assert.equal(
      await requestPolicy(afterPruning, "PUT", "/v1/reconcile", {
        startedAt: 20,
        policies: [policy],
      }),
      409,
    );
    assert.equal(installed.has(policy.applicationId), false);
    assert.equal(
      await requestPolicy(afterPruning, "PUT", path, {
        ...policy,
        generation: 50,
      }),
      200,
    );
    assert.equal(installed.get(policy.applicationId)?.generation, 50);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a failed guarded removal preserves startup protection for restart", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const statePath = join(directory, "policies.json");
  const path = "/v1/policies/startup-app-1";
  const policy: FirewallPolicy = {
    applicationId: "startup-app-1",
    containerId: "startup-token",
    containerIp: "10.0.0.0/24",
    enabled: true,
    allowCidrs: [],
    generation: 10,
    startup: true,
  };
  const store = new FirewallPolicyStore(statePath);
  const server = createFirewallAgentServer({
    secret: "secret",
    store,
    adapter: {
      ...adapter,
      remove() {
        throw new Error("host rejected guard removal");
      },
    },
  });
  context.mock.method(console, "error", () => undefined);
  try {
    assert.equal(await requestPolicy(server, "PUT", path, policy), 200);
    assert.equal(
      await requestPolicy(server, "DELETE", `${path}?containerId=old-token`),
      200,
    );
    assert.equal(
      await requestPolicy(
        server,
        "DELETE",
        `${path}?containerId=startup-token`,
      ),
      500,
    );
    const restored = new FirewallPolicyStore(statePath).load();
    assert.deepEqual(restored.policies.get(policy.applicationId), policy);
    assert.equal(restored.removals.has(policy.applicationId), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("server rejects unauthorized and oversized policy requests", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const server = createFirewallAgentServer({
    secret: "secret",
    adapter,
    store: new FirewallPolicyStore(join(directory, "policies.json")),
  });
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
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
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
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
    const state = store.snapshot();
    state.policies.set("app-1", {
      applicationId: "app-1",
      containerId: "new-runtime",
      containerIp: "10.0.0.2",
      enabled: true,
      allowCidrs: [],
      generation: 1,
    });
    store.save(state);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    const remove = (containerId: string, generation?: number) => {
      const query = new URLSearchParams({ containerId });
      if (generation !== undefined) query.set("generation", String(generation));
      return fetch(`http://127.0.0.1:${port}/v1/policies/app-1?${query}`, {
        method: "DELETE",
        headers: { "x-firewall-agent-secret": "secret" },
      });
    };

    assert.equal((await remove("old-runtime")).status, 200);
    assert.equal(
      store.snapshot().policies.get("app-1")?.containerId,
      "new-runtime",
    );
    assert.equal(removals, 0);

    assert.equal((await remove("new-runtime", 0)).status, 200);
    assert.equal(store.snapshot().policies.get("app-1")?.generation, 1);
    assert.equal(removals, 0);

    assert.equal((await remove("new-runtime", 2)).status, 200);
    assert.equal(store.snapshot().policies.get("app-1"), undefined);
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
    const state = store.snapshot();
    state.policies.set(runtimePolicy.applicationId, runtimePolicy);
    state.policies.set("startup-app-1", {
      ...runtimePolicy,
      applicationId: "startup-app-1",
      containerIp: "10.0.0.0/24",
      startup: true,
    });
    store.save(state);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    const reconcile = (startedAt: number) =>
      fetch(`http://127.0.0.1:${port}/v1/reconcile`, {
        method: "PUT",
        headers: { "x-firewall-agent-secret": "secret" },
        body: JSON.stringify({ policies: [], startedAt }),
      });

    assert.equal((await reconcile(3)).status, 200);
    assert.equal(store.snapshot().policies.get("startup-app-1")?.startup, true);
    assert.deepEqual(store.snapshot().policies.get("app-1"), runtimePolicy);
    const withoutGuard = store.snapshot();
    withoutGuard.policies.delete("startup-app-1");
    const newerPolicy = { ...runtimePolicy, generation: 5 };
    withoutGuard.policies.set("app-1", newerPolicy);
    store.save(withoutGuard);
    assert.equal((await reconcile(1)).status, 409);
    assert.equal((await reconcile(4)).status, 200);
    assert.deepEqual(store.snapshot().policies.get("app-1"), newerPolicy);
    assert.equal((await reconcile(6)).status, 200);
    assert.equal(store.snapshot().policies.get("app-1"), undefined);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});
