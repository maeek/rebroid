import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { createFirewallAgentConfig } from "./config";
import type { FirewallAdapter, FirewallPolicy } from "./firewall";
import { FirewallPolicyCommands } from "./policy-commands";
import { FirewallPolicyStore } from "./policy-store";
import { createFirewallAgentServer } from "./server";

const adapter: FirewallAdapter = {
  name: "test",
  initialize() {},
  apply() {},
  remove() {},
  reconcile() {},
};

test("startup recovery reinstalls saved policies without rewriting legacy state", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const statePath = join(directory, "policies.json");
  const policy: FirewallPolicy = {
    applicationId: "startup-app-1",
    containerId: "startup-token",
    containerIp: "10.0.0.0/24",
    enabled: true,
    allowCidrs: [],
    generation: 10,
    startup: true,
  };
  const saved = JSON.stringify([policy], null, 2);
  writeFileSync(statePath, saved);
  const installed = new Map<string, FirewallPolicy>();

  const recovery = FirewallPolicyCommands.restore(
    new FirewallPolicyStore(statePath),
    () => ({
      ...adapter,
      reconcile(policies) {
        for (const [id, desired] of policies) installed.set(id, desired);
      },
    }),
  );

  assert.ok(recovery.commands);
  assert.deepEqual(installed.get(policy.applicationId), policy);
  assert.equal(readFileSync(statePath, "utf8"), saved);
});

function startTestServer(
  store: FirewallPolicyStore,
  backend = adapter,
  getSecret = () => "secret",
) {
  return createFirewallAgentServer({
    getSecret,
    recovery: FirewallPolicyCommands.restore(store, () => backend),
  });
}

function requestAgent(
  server: ReturnType<typeof createFirewallAgentServer>,
  method: string,
  url: string,
  body?: unknown,
) {
  return new Promise<{ status: number; body: unknown }>((resolve) => {
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
      end(payload: string) {
        resolve({ status, body: JSON.parse(payload) });
      },
    };
    server.emit("request", request, response);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function requestPolicy(
  server: ReturnType<typeof createFirewallAgentServer>,
  method: string,
  url: string,
  body?: unknown,
) {
  return (await requestAgent(server, method, url, body)).status;
}

test("server reports failed recovery and rejects authenticated policy commands", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const server = startTestServer(
    new FirewallPolicyStore(join(directory, "policies.json")),
    {
      ...adapter,
      reconcile() {
        throw new Error("host rejected recovery");
      },
    },
  );

  const message = "Firewall backend is unavailable: host rejected recovery";
  assert.deepEqual(await requestAgent(server, "GET", "/v1/health"), {
    status: 503,
    body: { ok: false, status: "unhealthy", adapter: "test", message },
  });
  assert.deepEqual(await requestAgent(server, "PUT", "/v1/reconcile"), {
    status: 503,
    body: { message },
  });
});

test("server restores saved rules before the generated shared secret is available", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const statePath = join(directory, "policies.json");
  const secretPath = join(directory, "shared-secret");
  const { getSecret } = createFirewallAgentConfig({
    FIREWALL_AGENT_SHARED_SECRET: "",
    FIREWALL_AGENT_SHARED_SECRET_FILE: secretPath,
  });
  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "container-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 10,
  };
  writeFileSync(statePath, JSON.stringify([policy]));
  const installed: FirewallPolicy[] = [];
  const server = startTestServer(
    new FirewallPolicyStore(statePath),
    {
      ...adapter,
      reconcile(policies) {
        installed.push(...policies.values());
      },
    },
    getSecret,
  );

  assert.deepEqual(installed, [policy]);
  assert.deepEqual(await requestAgent(server, "GET", "/v1/health"), {
    status: 503,
    body: {
      ok: false,
      status: "unhealthy",
      adapter: "test",
      message:
        "Firewall agent shared secret is not configured; policy operations are disabled.",
    },
  });
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/reconcile", { policies: [] }),
    401,
  );
  assert.deepEqual(installed, [policy]);

  writeFileSync(secretPath, "");
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/reconcile", { policies: [] }),
    401,
  );
  writeFileSync(secretPath, "secret\n");
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/reconcile", { policies: [] }),
    200,
  );

  rmSync(secretPath);
  assert.equal((await requestAgent(server, "GET", "/v1/health")).status, 200);
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/reconcile", { policies: [] }),
    200,
  );
});

test("viewer refreshes only the installed revision of the same enabled runtime", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const installed: FirewallPolicy[] = [];
  const removals: string[] = [];
  const server = startTestServer(
    new FirewallPolicyStore(join(directory, "policies.json")),
    {
      ...adapter,
      apply(policy) {
        installed.push(policy);
      },
      remove(id) {
        removals.push(id);
      },
    },
  );
  const path = "/v1/policies/app-1";
  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "current",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: ["192.0.2.0/24"],
    generation: 10,
    revision: 2,
  };
  assert.equal(await requestPolicy(server, "PUT", path, policy), 200);
  for (const change of [
    { revision: 1 },
    { revision: 3 },
    { containerId: "replaced" },
    { enabled: false },
  ]) {
    assert.equal(
      await requestPolicy(server, "PUT", `${path}/refresh`, {
        ...policy,
        generation: 20,
        ...change,
      }),
      409,
    );
  }
  assert.equal(await requestPolicy(server, "DELETE", `${path}/refresh`), 405);
  assert.deepEqual(installed, [policy]);
  assert.deepEqual(removals, []);

  const refreshed = {
    ...policy,
    generation: 20,
    allowCidrs: ["192.0.2.0/24", "10.0.0.3/32"],
  };
  assert.equal(
    await requestPolicy(server, "PUT", `${path}/refresh`, refreshed),
    200,
  );
  assert.deepEqual(installed, [policy, refreshed]);
});

test("older policy revisions cannot replace or remove newer rules across restart", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const statePath = join(directory, "policies.json");
  const path = "/v1/policies/app-1";
  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "current",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: ["192.0.2.0/24"],
    generation: 10,
    revision: 2,
  };
  const initial = startTestServer(new FirewallPolicyStore(statePath));
  assert.equal(await requestPolicy(initial, "PUT", path, policy), 200);

  const store = new FirewallPolicyStore(statePath);
  const restarted = startTestServer(store);
  const old = { ...policy, revision: 1, generation: 20, allowCidrs: [] };
  assert.equal(await requestPolicy(restarted, "PUT", path, old), 409);
  assert.deepEqual(
    await requestAgent(
      restarted,
      "DELETE",
      `${path}?containerId=current&revision=1&generation=20`,
    ),
    { status: 200, body: { status: "unchanged" } },
  );
  assert.equal(
    await requestPolicy(restarted, "PUT", "/v1/reconcile", {
      policies: [old],
      startedAt: 20,
    }),
    200,
  );
  assert.deepEqual(store.snapshot().policies.get(policy.applicationId), policy);

  assert.equal(
    await requestPolicy(
      restarted,
      "DELETE",
      `${path}?containerId=current&revision=3&generation=30`,
    ),
    200,
  );
  assert.equal(
    await requestPolicy(restarted, "PUT", "/v1/reconcile", {
      policies: [],
      startedAt: 40,
    }),
    200,
  );
  const afterRemoval = startTestServer(new FirewallPolicyStore(statePath));
  const delayed = { ...policy, generation: 50 };
  assert.equal(await requestPolicy(afterRemoval, "PUT", path, delayed), 409);
  assert.equal(
    await requestPolicy(afterRemoval, "PUT", `${path}/refresh`, delayed),
    409,
  );
});

test("an unrelated firewall write uses the last committed policies after a rejected snapshot", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  context.mock.method(console, "error", () => undefined);
  const statePath = join(directory, "policies.json");
  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "runtime-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 10,
    revision: 1,
  };
  let installed = new Map<string, FirewallPolicy>();
  const backend: FirewallAdapter = {
    ...adapter,
    apply(_policy, policies) {
      installed = new Map(policies);
    },
    reconcile(policies) {
      if (installed.size && !policies.size) throw new Error("restore rejected");
      installed = new Map(policies);
    },
  };
  const server = startTestServer(new FirewallPolicyStore(statePath), backend);
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/policies/app-1", policy),
    200,
  );
  const committed = readFileSync(statePath, "utf8");
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/reconcile", {
      policies: [],
      startedAt: 30,
    }),
    500,
  );
  assert.equal(readFileSync(statePath, "utf8"), committed);

  const other = {
    ...policy,
    applicationId: "app-2",
    containerId: "runtime-2",
    containerIp: "10.0.0.3",
    generation: 40,
  };
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/policies/app-2", other),
    200,
  );
  assert.deepEqual(
    installed,
    new Map([
      ["app-1", policy],
      ["app-2", other],
    ]),
  );
  startTestServer(new FirewallPolicyStore(statePath), backend);
  assert.deepEqual(
    installed,
    new Map([
      ["app-1", policy],
      ["app-2", other],
    ]),
  );
});

function failPolicyPersistence(
  ...[, install]: Parameters<FirewallPolicyStore["save"]>
): never {
  install?.();
  throw new Error("rename failed");
}

test("policy persistence failure with successful rollback keeps health ready", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  context.mock.method(console, "error", () => undefined);
  const store = new FirewallPolicyStore(join(directory, "policies.json"));
  let installed = new Map<string, FirewallPolicy>();
  const server = startTestServer(store, {
    ...adapter,
    apply(_policy, policies) {
      installed = new Map(policies);
    },
    reconcile(policies) {
      installed = new Map(policies);
    },
  });
  context.mock.method(store, "save", failPolicyPersistence, { times: 1 });

  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "runtime-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 10,
    revision: 1,
  };
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/policies/app-1", policy),
    500,
  );
  assert.equal(installed.size, 0);
  assert.equal(store.snapshot().policies.size, 0);
  assert.equal((await requestAgent(server, "GET", "/v1/health")).status, 200);
});

test("failed policy rollback degrades health until committed rules can be restored", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  context.mock.method(console, "error", () => undefined);
  const statePath = join(directory, "policies.json");
  const store = new FirewallPolicyStore(statePath);
  let installed = new Map<string, FirewallPolicy>();
  let recoveryAvailable = true;
  const recoveryAttempts: Map<string, FirewallPolicy>[] = [];
  const server = startTestServer(store, {
    ...adapter,
    apply(_policy, policies) {
      installed = new Map(policies);
    },
    reconcile(policies) {
      recoveryAttempts.push(new Map(policies));
      if (!recoveryAvailable) throw new Error("host rejected recovery");
      installed = new Map(policies);
    },
  });
  const committed: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "runtime-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 10,
    revision: 1,
  };
  const candidate = {
    ...committed,
    allowCidrs: ["10.0.0.0/8"],
    generation: 20,
    revision: 2,
  };
  const path = "/v1/policies/app-1";
  assert.equal(await requestPolicy(server, "PUT", path, committed), 200);
  const saved = readFileSync(statePath, "utf8");

  context.mock.method(store, "save", failPolicyPersistence, { times: 1 });
  recoveryAvailable = false;
  assert.equal(await requestPolicy(server, "PUT", path, candidate), 500);
  assert.deepEqual(installed.get("app-1"), candidate);
  assert.equal(readFileSync(statePath, "utf8"), saved);
  assert.deepEqual(await requestAgent(server, "GET", "/v1/health"), {
    status: 503,
    body: {
      ok: false,
      status: "unhealthy",
      adapter: "test",
      message:
        "Firewall rules could not be restored from committed policy state.",
    },
  });
  assert.equal(recoveryAttempts.length, 2);

  const retry = { ...committed, generation: 15 };
  assert.equal(await requestPolicy(server, "PUT", path, retry), 503);
  assert.equal(readFileSync(statePath, "utf8"), saved);
  assert.deepEqual(installed.get("app-1"), candidate);

  recoveryAvailable = true;
  assert.equal(await requestPolicy(server, "PUT", path, retry), 200);
  assert.equal(recoveryAttempts.length, 4);
  for (const policies of recoveryAttempts.slice(1)) {
    assert.deepEqual(policies.get("app-1"), committed);
  }
  assert.deepEqual(installed.get("app-1"), retry);
  assert.deepEqual(store.snapshot().policies.get("app-1"), retry);
  assert.equal((await requestAgent(server, "GET", "/v1/health")).status, 200);
});

test("a viewer refresh cannot use a rejected individual firewall write", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  context.mock.method(console, "error", () => undefined);
  const statePath = join(directory, "policies.json");
  const backend: FirewallAdapter = {
    ...adapter,
    apply() {
      throw new Error("restore rejected");
    },
  };
  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "runtime-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 10,
    revision: 1,
  };
  const server = startTestServer(new FirewallPolicyStore(statePath), backend);
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/policies/app-1", policy),
    500,
  );
  for (const candidate of [
    server,
    startTestServer(new FirewallPolicyStore(statePath), backend),
  ]) {
    assert.equal(
      await requestPolicy(candidate, "PUT", "/v1/policies/app-1/refresh", {
        ...policy,
        generation: 20,
      }),
      409,
    );
  }
});

test("bulk snapshots respect policy revisions and runtime generation ordering", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new FirewallPolicyStore(join(directory, "policies.json"));
  const server = startTestServer(store);
  const policy: FirewallPolicy = {
    applicationId: "app-1",
    containerId: "runtime-1",
    containerIp: "10.0.0.2",
    enabled: true,
    allowCidrs: [],
    generation: 30,
    revision: 1,
  };
  const snapshot = (policies: FirewallPolicy[], startedAt?: number) =>
    requestPolicy(server, "PUT", "/v1/reconcile", { policies, startedAt });
  assert.equal(
    await requestPolicy(server, "PUT", "/v1/policies/app-1", policy),
    200,
  );
  assert.equal(await snapshot([], 20), 200);
  for (const generation of [10, 25]) {
    assert.equal(await snapshot([{ ...policy, generation }]), 200);
    assert.deepEqual(store.snapshot().policies.get("app-1"), policy);
  }
  const newRevision = { ...policy, revision: 2, allowCidrs: ["192.0.2.0/24"] };
  assert.equal(await snapshot([newRevision], 30), 200);
  assert.deepEqual(store.snapshot().policies.get("app-1"), newRevision);
  assert.equal(
    await snapshot(
      [{ ...newRevision, containerId: "old-runtime", revision: 3 }],
      30,
    ),
    200,
  );
  assert.deepEqual(store.snapshot().policies.get("app-1"), newRevision);
  const laterRevision = { ...newRevision, revision: 3, generation: 25 };
  assert.equal(await snapshot([laterRevision]), 200);
  assert.deepEqual(store.snapshot().policies.get("app-1"), laterRevision);
});

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
  const server = startTestServer(new FirewallPolicyStore(statePath));
  assert.equal(
    await requestPolicy(server, "DELETE", `${path}?containerId=old`),
    200,
  );

  const store = new FirewallPolicyStore(statePath);
  const restarted = startTestServer(store);
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
    const initial = startTestServer(
      new FirewallPolicyStore(statePath),
      backend,
    );
    assert.equal(await requestPolicy(initial, "PUT", path, policy), 200);
    assert.equal(await requestPolicy(initial, "DELETE", path), 200);
    assert.equal(installed.has(policy.applicationId), false);

    const restarted = startTestServer(
      new FirewallPolicyStore(statePath),
      backend,
    );
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
    const afterPruning = startTestServer(reloaded, backend);
    assert.equal(reloaded.snapshot().removals.has(policy.applicationId), false);
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
  const server = startTestServer(store, {
    ...adapter,
    remove() {
      throw new Error("host rejected guard removal");
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
    const restored = new FirewallPolicyStore(statePath);
    const installed: FirewallPolicy[] = [];
    startTestServer(restored, {
      ...adapter,
      reconcile(policies) {
        installed.push(...policies.values());
      },
    });
    assert.deepEqual(installed, [policy]);
    assert.equal(restored.snapshot().removals.has(policy.applicationId), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("server rejects unauthorized and oversized policy requests", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-server-"));
  const server = startTestServer(
    new FirewallPolicyStore(join(directory, "policies.json")),
  );
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
  const server = startTestServer(
    new FirewallPolicyStore(join(directory, "policies.json")),
    failingAdapter,
  );
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
  const server = startTestServer(store, {
    ...adapter,
    remove: () => {
      removals += 1;
    },
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
  const server = startTestServer(store);
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
