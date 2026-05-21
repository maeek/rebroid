import { isIP } from 'node:net';
import { parseJsonStringArray } from '../../common/json-array';

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

export const normalizeIpv4Cidr = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const [address, prefix] = trimmed.split('/');
  if (isIP(address) !== 4) {
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

export const parseAllowCidrs = (value: string) =>
  parseJsonStringArray(value)
    .map((item) => normalizeIpv4Cidr(item))
    .filter((item): item is string => Boolean(item));

export const uniqueStrings = (values: string[]) => [...new Set(values)];

export const networkPolicyChainName = (applicationId: string) =>
  `rebroid-${applicationId.replace(/-/g, '').slice(0, 24)}`;
