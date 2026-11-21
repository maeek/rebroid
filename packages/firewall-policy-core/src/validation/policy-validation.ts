import { normalizeIpv4Cidr } from "../cidr/ipv4-cidr";
import type { FirewallPolicy } from "../policy/types";

const MAX_ALLOW_CIDRS = 256;
const APPLICATION_ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;
const CONTAINER_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

export class InvalidFirewallPolicyError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const isFirewallApplicationId = (value: unknown): value is string =>
  typeof value === "string" && APPLICATION_ID.test(value);

export const validatePolicy = (
  applicationId: unknown,
  body: unknown,
): FirewallPolicy => {
  if (!isFirewallApplicationId(applicationId)) {
    throw new InvalidFirewallPolicyError("Invalid application id.");
  }
  if (!isRecord(body)) throw new InvalidFirewallPolicyError("Invalid policy.");
  const { containerId, containerIp, generation, revision, enabled } = body;
  if (typeof containerId !== "string" || !CONTAINER_ID.test(containerId)) {
    throw new InvalidFirewallPolicyError("Invalid container id.");
  }
  if (
    (enabled !== undefined && typeof enabled !== "boolean") ||
    (body.startup !== undefined && typeof body.startup !== "boolean")
  ) {
    throw new InvalidFirewallPolicyError("Invalid policy flags.");
  }
  const startup = body.startup === true;
  const source = typeof containerIp === "string" ? containerIp : "";
  const sourceCidr = normalizeIpv4Cidr(source);
  if (
    !sourceCidr ||
    (startup
      ? !/\/([1-9]|[12]\d|3[0-2])$/.test(source) || sourceCidr !== source
      : source.includes("/"))
  ) {
    throw new InvalidFirewallPolicyError("Invalid container address.");
  }
  if (!isNonnegativeInteger(generation)) {
    throw new InvalidFirewallPolicyError("Invalid policy generation.");
  }
  if (revision !== undefined && (!isNonnegativeInteger(revision) || startup)) {
    throw new InvalidFirewallPolicyError("Invalid policy revision.");
  }
  if (
    !Array.isArray(body.allowCidrs) ||
    body.allowCidrs.length > MAX_ALLOW_CIDRS
  ) {
    throw new InvalidFirewallPolicyError("Invalid allowlist.");
  }
  const allowCidrs = new Set<string>();
  for (const value of body.allowCidrs) {
    const cidr =
      typeof value === "string" && value.includes("/")
        ? normalizeIpv4Cidr(value)
        : null;
    if (!cidr)
      throw new InvalidFirewallPolicyError("Only IPv4 CIDRs are supported.");
    allowCidrs.add(cidr);
  }
  if (startup && (enabled === false || allowCidrs.size > 0)) {
    throw new InvalidFirewallPolicyError("Invalid startup policy.");
  }
  return {
    applicationId,
    containerId,
    containerIp: source.trim(),
    enabled: enabled !== false,
    allowCidrs: [...allowCidrs],
    generation,
    ...(revision !== undefined ? { revision } : {}),
    ...(startup ? { startup: true } : {}),
  };
};

export const validatePolicies = (body: unknown) => {
  if (!isRecord(body) || !Array.isArray(body.policies)) {
    throw new InvalidFirewallPolicyError("Invalid policy list.");
  }
  const desired = new Map<string, FirewallPolicy>();
  for (const row of body.policies) {
    if (!isRecord(row)) throw new InvalidFirewallPolicyError("Invalid policy.");
    const policy = validatePolicy(row.applicationId, row);
    desired.set(policy.applicationId, policy);
  }
  return desired;
};
