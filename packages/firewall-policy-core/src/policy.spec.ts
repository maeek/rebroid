import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  allowsBroadInternetAccess,
  firewallChainName,
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

  it("requires exactly one decimal prefix when a slash is present", () => {
    for (const invalid of [
      "192.0.2.0/",
      "192.0.2.0/24/1",
      "192.0.2.0/2e1",
      "192.0.2.0/-1",
    ]) {
      assert.equal(normalizeIpv4Cidr(invalid), null);
    }
    for (let prefix = 0; prefix <= 32; prefix++) {
      const cidr = "192.0.2.0/" + prefix;
      assert.equal(normalizeIpv4Cidr(cidr), cidr);
    }
  });

  it("creates stable firewall chain names for agent rules", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
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
    assert.equal(allowsBroadInternetAccess(["0.0.0.0/1"]), true);
    assert.equal(allowsBroadInternetAccess(["1.0.0.0/17", "8.0.0.0/17"]), true);
    assert.equal(
      allowsBroadInternetAccess(["1.0.0.0/17", "1.0.0.0/18"]),
      false,
    );
  });
});
