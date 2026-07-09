import test from "node:test";
import assert from "node:assert/strict";
import {
  chainName,
  IptablesAdapter,
  validatePolicies,
  validatePolicy,
  type FirewallCommandRunner,
} from "./firewall";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FirewallPolicyStore } from "./policy-store";

test("creates deterministic owned chain names", () => {
  assert.equal(
    chainName("12345678-1234-1234-1234-123456789abc"),
    "RB_APP_1234567812341234",
  );
});

test("keeps atomic iptables replacement chains within the compatibility limit", () => {
  assert.ok(
    `${chainName("12345678-1234-1234-1234-123456789abc")}_NEXT`.length < 29,
  );
});

test("validates and deduplicates IPv4 policies", () => {
  const policy = validatePolicy("app-1", {
    containerId: "abc123",
    containerIp: "172.18.0.2",
    enabled: true,
    allowCidrs: ["10.0.0.0/8", "10.0.0.0/8"],
    generation: 1,
  });
  assert.deepEqual(policy.allowCidrs, ["10.0.0.0/8"]);
});

test("rejects IPv6 CIDRs", () => {
  assert.throws(
    () =>
      validatePolicy("app-1", {
        containerId: "abc123",
        containerIp: "172.18.0.2",
        allowCidrs: ["::/0"],
        generation: 1,
      }),
    /Only IPv4/,
  );
});

test("authoritative reconciliation rejects a missing policy list", () => {
  assert.throws(() => validatePolicies({}), /Invalid policy list/);
});

test("authoritative reconciliation builds a desired policy map", () => {
  const policies = validatePolicies({
    policies: [
      {
        applicationId: "app-1",
        containerId: "abc123",
        containerIp: "172.18.0.2",
        allowCidrs: ["10.0.0.0/8"],
        generation: 2,
      },
    ],
  });
  assert.equal(policies.get("app-1")?.generation, 2);
});

test("iptables adapters execute through the injected command runner", () => {
  const calls: Array<{ binary: string; args: string[] }> = [];
  const runner: FirewallCommandRunner = {
    run(binary, args) {
      calls.push({ binary, args });
      return { ok: args[1] !== "-C", output: "" };
    },
  };
  const adapter = new IptablesAdapter("DOCKER-USER", runner);
  adapter.apply(
    validatePolicy("app-1", {
      containerId: "container-1",
      containerIp: "172.18.0.2",
      allowCidrs: ["10.0.0.0/8"],
      generation: 1,
    }),
  );
  assert.ok(calls.some((call) => call.args.includes("10.0.0.0/8")));
  assert.ok(calls.every((call) => call.binary === "iptables"));
});

test("policy storage atomically replaces and reloads desired state", () => {
  const directory = mkdtempSync(join(tmpdir(), "rebroid-firewall-"));
  try {
    const statePath = join(directory, "policies.json");
    const store = new FirewallPolicyStore(statePath);
    const policy = validatePolicy("app-1", {
      containerId: "container-1",
      containerIp: "172.18.0.2",
      allowCidrs: ["10.0.0.0/8"],
      generation: 3,
    });
    store.set(policy);
    assert.equal(JSON.parse(readFileSync(statePath, "utf8"))[0].generation, 3);
    assert.equal(
      new FirewallPolicyStore(statePath).load().get("app-1")?.generation,
      3,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
