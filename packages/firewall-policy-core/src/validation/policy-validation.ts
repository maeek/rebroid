import { normalizeIpv4Cidr } from "../cidr/ipv4-cidr";
import { uniqueStrings } from "../policy/string-list";
import type { FirewallPolicy } from "../policy/types";

const MAX_ALLOW_CIDRS = 256;
const APPLICATION_ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;
const CONTAINER_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

export const validatePolicy = (
  applicationId: string,
  body: Partial<FirewallPolicy>,
): FirewallPolicy => {
  if (!APPLICATION_ID.test(applicationId)) {
    throw new Error("Invalid application id.");
  }
  if (!CONTAINER_ID.test(body.containerId ?? "")) {
    throw new Error("Invalid container id.");
  }
  if (!normalizeIpv4Cidr(`${body.containerIp ?? ""}/32`)) {
    throw new Error("Invalid container address.");
  }
  if (!Number.isSafeInteger(body.generation) || (body.generation ?? -1) < 0) {
    throw new Error("Invalid policy generation.");
  }
  if (
    !Array.isArray(body.allowCidrs) ||
    body.allowCidrs.length > MAX_ALLOW_CIDRS
  ) {
    throw new Error("Invalid allowlist.");
  }
  const allowCidrs = body.allowCidrs.map((cidr) =>
    typeof cidr === "string" && cidr.includes("/")
      ? normalizeIpv4Cidr(cidr)
      : null,
  );
  if (allowCidrs.some((cidr) => cidr === null)) {
    throw new Error("Only IPv4 CIDRs are supported.");
  }
  return {
    applicationId,
    containerId: body.containerId!,
    containerIp: body.containerIp!,
    enabled: body.enabled !== false,
    allowCidrs: uniqueStrings(allowCidrs as string[]),
    generation: body.generation!,
  };
};

export const validatePolicies = (body: {
  policies?: Partial<FirewallPolicy>[];
}) => {
  if (!Array.isArray(body.policies)) {
    throw new Error("Invalid policy list.");
  }
  const desired = new Map<string, FirewallPolicy>();
  for (const policy of body.policies) {
    if (typeof policy.applicationId !== "string") {
      throw new Error("Invalid application id.");
    }
    desired.set(
      policy.applicationId,
      validatePolicy(policy.applicationId, policy),
    );
  }
  return desired;
};
