export {
  networkPolicyChainName,
  normalizeIpv4Cidr,
  parseAllowCidrs,
  uniqueStrings,
} from '@rebroid/firewall-policy-core/policy';

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
