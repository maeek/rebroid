const MAX_ALLOW_CIDRS = 256;
const APPLICATION_ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;
const CONTAINER_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const IPV4_ADDRESS =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export interface FirewallPolicy {
  applicationId: string;
  containerId: string;
  containerIp: string;
  enabled: boolean;
  allowCidrs: string[];
  generation: number;
}

export type FirewallAgentPolicy = Omit<FirewallPolicy, "applicationId">;

export const normalizeIpv4Cidr = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const [address, prefix] = trimmed.split("/");
  if (!IPV4_ADDRESS.test(address)) {
    return null;
  }

  if (prefix === undefined) {
    return `${address}/32`;
  }

  const numericPrefix = Number(prefix);
  if (
    !Number.isInteger(numericPrefix) ||
    numericPrefix < 0 ||
    numericPrefix > 32
  ) {
    return null;
  }

  return `${address}/${numericPrefix}`;
};

export const parseJsonStringArray = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

export const parseAllowCidrs = (value: string) =>
  parseJsonStringArray(value)
    .map((item) => normalizeIpv4Cidr(item))
    .filter((item): item is string => Boolean(item));

export const uniqueStrings = (values: string[]) => [...new Set(values)];

export const networkPolicyChainName = (applicationId: string) =>
  `rebroid-${applicationId.replace(/-/g, "").slice(0, 24)}`;

export const firewallChainName = (applicationId: string) =>
  `RB_APP_${applicationId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;

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

const isBroadInternetCidr = (cidr: string) => {
  const normalized = cidr.trim().toLowerCase();
  return normalized === "0.0.0.0/0" || normalized === "::/0";
};

const ipv4Range = (cidr: string) => {
  const normalized = normalizeIpv4Cidr(cidr);
  if (!normalized) {
    return null;
  }

  const [address, rawPrefix] = normalized.split("/");
  const octets = address.split(".").map(Number);
  const prefix = Number(rawPrefix);
  const value = octets.reduce((result, octet) => result * 256 + octet, 0);
  const size = 2 ** (32 - prefix);
  const start = Math.floor(value / size) * size;
  return { start, end: start + size - 1 };
};

export const allowsBroadInternetAccess = (cidrs: string[]) => {
  if (cidrs.some(isBroadInternetCidr)) {
    return true;
  }

  const ranges = cidrs
    .map(ipv4Range)
    .filter((range): range is NonNullable<typeof range> => Boolean(range))
    .sort((left, right) => left.start - right.start);
  let coveredThrough = -1;
  for (const range of ranges) {
    if (range.start > coveredThrough + 1) {
      return false;
    }
    coveredThrough = Math.max(coveredThrough, range.end);
    if (coveredThrough >= 2 ** 32 - 1) {
      return true;
    }
  }

  return false;
};
