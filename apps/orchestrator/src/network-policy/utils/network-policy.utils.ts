export {
  networkPolicyChainName,
  normalizeIpv4Cidr,
  parseAllowCidrs,
} from '@rebroid/firewall-policy-core/policy';

export const uniqueStrings = (values: string[]) => [...new Set(values)];

export const extractHostname = (value?: string) => {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();
  try {
    const normalized = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
    return new URL(normalized).hostname;
  } catch {
    return trimmed;
  }
};
