import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  allowsBroadInternetAccess,
  firewallChainName,
  networkPolicyChainName,
  normalizeIpv4Cidr,
  parseAllowCidrs,
  validatePolicies,
  validatePolicy,
} from "./policy";

describe("firewall policy core", () => {
  it("normalizes IPv4 CIDRs and filters JSON allowlists", () => {
    assert.equal(normalizeIpv4Cidr("10.0.0.5"), "10.0.0.5/32");
    assert.equal(normalizeIpv4Cidr("10.0.0.0/24"), "10.0.0.0/24");
    assert.equal(normalizeIpv4Cidr("10.0.0.0/99"), null);
    assert.deepEqual(parseAllowCidrs('["10.0.0.5", "bad"]'), ["10.0.0.5/32"]);
  });

  it("creates stable chain names for orchestrator metadata and agent rules", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    assert.equal(
      networkPolicyChainName(id),
      "rebroid-123456781234123412341234",
    );
    assert.equal(firewallChainName(id), "RB_APP_1234567812341234");
  });

  it("validates and deduplicates policies", () => {
    const policy = validatePolicy("app-1", {
      containerId: "abc123",
      containerIp: "172.18.0.2",
      enabled: true,
      allowCidrs: ["10.0.0.0/8", "10.0.0.0/8"],
      generation: 1,
    });
    assert.deepEqual(policy.allowCidrs, ["10.0.0.0/8"]);
    assert.throws(
      () =>
        validatePolicy("app-1", {
          containerId: "abc123",
          containerIp: "172.18.0.2",
          allowCidrs: ["10.0.0.5"],
          generation: 1,
        }),
      /Only IPv4/,
    );
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

  it("validates authoritative policy lists", () => {
    assert.throws(() => validatePolicies({}), /Invalid policy list/);
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

  it("detects broad internet coverage", () => {
    assert.equal(allowsBroadInternetAccess(["0.0.0.0/0"]), true);
    assert.equal(allowsBroadInternetAccess(["10.0.0.0/8"]), false);
  });
});
