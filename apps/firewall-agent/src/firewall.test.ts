import test from "node:test";
import assert from "node:assert/strict";
import {
  chainName,
  IptablesAdapter,
  validatePolicies,
  validatePolicy,
  type FirewallCommandRunner,
} from "./firewall";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FirewallPolicyStore } from "./policy-store";

test("creates deterministic owned chain names", () => {
  assert.equal(
    chainName("12345678-1234-1234-1234-123456789abc"),
    "RB_APP_1234567812341234",
  );
});

test("keeps iptables policy chains within the compatibility limit", () => {
  assert.ok(chainName("12345678-1234-1234-1234-123456789abc").length < 29);
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

test("a failed iptables restore leaves the previously committed rules alone", () => {
  const previous = "-A DOCKER-USER -j REBROID_FW\n-A REBROID_FW -j REJECT\n";
  const calls: string[] = [];
  let installed = previous;
  const runner: FirewallCommandRunner = {
    run(binary, args, options) {
      calls.push(binary);
      if (binary === "iptables" && args.includes("-S")) {
        return { ok: true, output: installed };
      }
      if (binary === "iptables-restore") {
        assert.match(options?.input ?? "", /\nCOMMIT\n$/);
        throw new Error("restore rejected");
      }
      installed = "";
      throw new Error("unexpected standalone mutation");
    },
  };
  const adapter = new IptablesAdapter("DOCKER-USER", runner);
  const policy = validatePolicy("app-1", {
    containerId: "container-1",
    containerIp: "172.18.0.2",
    allowCidrs: ["10.0.0.0/8"],
    generation: 1,
  });

  assert.throws(
    () => adapter.apply(policy, new Map([[policy.applicationId, policy]])),
    /restore rejected/,
  );
  assert.equal(installed, previous);
  assert.deepEqual(calls, ["iptables", "iptables-restore"]);
});

function recordIptablesRestores(listing = "") {
  const batches: Array<{ rules: string[]; ignoreFailure: boolean }> = [];
  const runner: FirewallCommandRunner = {
    run(binary, args, options) {
      if (binary === "iptables") {
        assert.ok(args.includes("-S"));
        return { ok: true, output: listing };
      }
      assert.equal(binary, "iptables-restore");
      assert.ok(args.includes("--noflush"));
      assert.ok(options?.input);
      batches.push({
        rules: options.input.trimEnd().split("\n"),
        ignoreFailure: options.ignoreFailure ?? false,
      });
      return { ok: true, output: "" };
    },
  };
  return { runner, batches };
}

test("legacy forwarding jumps are replaced in the same batch as the rebuilt rules", () => {
  const { runner, batches } = recordIptablesRestores(
    [
      "-N REBROID_FW",
      "-N REBROID_FW_NEXT",
      "-N RB_APP_APP1_NEXT",
      "-N UNRELATED",
      "-A DOCKER-USER -j REBROID_FW_NEXT",
      "-A DOCKER-USER -j REBROID_FW",
      "-A DOCKER-USER -j REBROID_FW",
      "-A DOCKER-USER -j UNRELATED",
      "-A REBROID_FW_NEXT -s 172.18.0.2/32 -j RB_APP_APP1_NEXT",
    ].join("\n"),
  );
  const adapter = new IptablesAdapter("DOCKER-USER", runner);
  const policy = validatePolicy("app-1", {
    containerId: "container-1",
    containerIp: "172.18.0.2",
    allowCidrs: ["10.0.0.0/8"],
    generation: 1,
  });

  adapter.reconcile(new Map([[policy.applicationId, policy]]));

  assert.deepEqual(batches, [
    {
      rules: [
        "*filter",
        ":REBROID_FW - [0:0]",
        ":RB_APP_APP1 - [0:0]",
        "-A RB_APP_APP1 -d 10.0.0.0/8 -j ACCEPT",
        "-A RB_APP_APP1 -j REJECT",
        "-A REBROID_FW -s 172.18.0.2 -j RB_APP_APP1",
        "-D DOCKER-USER -j REBROID_FW_NEXT",
        "-D DOCKER-USER -j REBROID_FW",
        "-D DOCKER-USER -j REBROID_FW",
        "-I DOCKER-USER 1 -j REBROID_FW",
        "COMMIT",
      ],
      ignoreFailure: false,
    },
    {
      rules: [
        "*filter",
        "-F REBROID_FW_NEXT",
        "-F RB_APP_APP1_NEXT",
        "-X REBROID_FW_NEXT",
        "-X RB_APP_APP1_NEXT",
        "COMMIT",
      ],
      ignoreFailure: true,
    },
  ]);
});

test("startup guards precede runtime allowlists when policies are committed", () => {
  const { runner, batches } = recordIptablesRestores();
  const adapter = new IptablesAdapter("FORWARD", runner);
  const runtime = validatePolicy("app-1", {
    containerId: "container-1",
    containerIp: "172.18.0.2",
    allowCidrs: ["10.0.0.0/8"],
    generation: 1,
  });
  const guard = validatePolicy("startup-app-1", {
    containerId: "guard-1",
    containerIp: "172.18.0.0/24",
    allowCidrs: [],
    generation: 2,
    startup: true,
  });
  const policies = new Map([
    [runtime.applicationId, runtime],
    [guard.applicationId, guard],
  ]);

  adapter.apply(guard, policies);

  assert.equal(batches.length, 1);
  const { rules } = batches[0];
  assert.deepEqual(
    rules.filter((rule) => rule.startsWith("-A REBROID_FW ")),
    [
      "-A REBROID_FW -s 172.18.0.0/24 -j RB_APP_STARTUPAPP1",
      "-A REBROID_FW -s 172.18.0.2 -j RB_APP_APP1",
    ],
  );
  assert.deepEqual(
    rules.filter((rule) => rule.startsWith("-A RB_APP_STARTUPAPP1 ")),
    ["-A RB_APP_STARTUPAPP1 -j REJECT"],
  );
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
    writeFileSync(statePath, JSON.stringify([policy]));
    const state = store.load();
    assert.equal(state.policies.get("app-1")?.generation, 3);
    state.removals.set("app-2", 4);
    store.save(state);
    assert.equal(
      JSON.parse(readFileSync(statePath, "utf8")).policies[0].generation,
      3,
    );
    assert.deepEqual(new FirewallPolicyStore(statePath).load(), state);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
