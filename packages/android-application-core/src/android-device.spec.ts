import assert from "node:assert/strict";
import test from "node:test";
import {
  createExternalAdbTcpAllowlist,
  isExternalAdbTcpNetwork,
} from "./android-device";

test("a CIDR permits all valid ports in the range and preserves exact endpoints", () => {
  const allowed = createExternalAdbTcpAllowlist([
    "10.20.0.0/24",
    "192.168.1.20:5555",
  ]);
  assert.equal(allowed("10.20.0.0:1"), true);
  assert.equal(allowed("10.20.0.255:65535"), true);
  assert.equal(allowed("10.20.1.0:5555"), false);
  assert.equal(allowed("10.20.0.144:0"), false);
  assert.equal(allowed("192.168.1.20:5555"), true);
  assert.equal(allowed("192.168.1.20:5556"), false);
});

test("invalid CIDRs fail validation and broad ranges preserve restricted address checks", () => {
  assert.equal(isExternalAdbTcpNetwork("10.20.0.144/24"), false);
  assert.equal(isExternalAdbTcpNetwork("10.20.0.144/32"), true);
  assert.equal(isExternalAdbTcpNetwork("10.20.0.0/33"), false);
  assert.equal(isExternalAdbTcpNetwork("10.20.00.0/24"), false);
  const allowed = createExternalAdbTcpAllowlist(["0.0.0.0/0"]);
  assert.equal(allowed("10.20.0.144:5555"), true);
  assert.equal(allowed("127.0.0.1:5555"), false);
  assert.equal(allowed("169.254.169.254:80"), false);
  assert.equal(allowed("100.100.100.200:80"), false);
});
