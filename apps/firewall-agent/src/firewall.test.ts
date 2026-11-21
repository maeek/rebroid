import test from "node:test";
import assert from "node:assert/strict";
import { validatePolicy } from "@rebroid/firewall-policy-core/policy";
import { IptablesAdapter, type FirewallCommandRunner } from "./firewall";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FirewallPolicyStore } from "./policy-store";

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
    () => adapter.reconcile(new Map([[policy.applicationId, policy]])),
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

test("forwarding jumps are replaced atomically before unused chains are removed", () => {
  const { runner, batches } = recordIptablesRestores(
    [
      "-N REBROID_FW",
      "-N RB_APP_RETIRED",
      "-N UNRELATED",
      "-A DOCKER-USER -j REBROID_FW",
      "-A DOCKER-USER -j REBROID_FW",
      "-A DOCKER-USER -j UNRELATED",
      "-A REBROID_FW -s 172.18.0.3/32 -j RB_APP_RETIRED",
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
        "-D DOCKER-USER -j REBROID_FW",
        "-D DOCKER-USER -j REBROID_FW",
        "-I DOCKER-USER 1 -j REBROID_FW",
        "COMMIT",
      ],
      ignoreFailure: false,
    },
    {
      rules: ["*filter", "-F RB_APP_RETIRED", "-X RB_APP_RETIRED", "COMMIT"],
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

  adapter.reconcile(policies);

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
    const state = store.load();
    state.policies.set("app-1", policy);
    store.save(state);
    state.removals.set("app-2", 4);
    assert.equal(store.snapshot().removals.has("app-2"), false);
    store.save(state);
    const observed = store.snapshot();
    observed.policies.get("app-1")!.allowCidrs.push("192.0.2.0/24");
    assert.deepEqual(store.snapshot().policies.get("app-1")!.allowCidrs, [
      "10.0.0.0/8",
    ]);
    assert.equal(
      JSON.parse(readFileSync(statePath, "utf8")).policies[0].generation,
      3,
    );
    assert.deepEqual(new FirewallPolicyStore(statePath).load(), state);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
