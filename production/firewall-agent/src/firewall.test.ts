import test from "node:test";
import assert from "node:assert/strict";
import { chainName, validatePolicies, validatePolicy } from "./firewall";

test("creates deterministic owned chain names", () => {
  assert.equal(
    chainName("12345678-1234-1234-1234-123456789abc"),
    "REBROID_APP_1234567812341234",
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
