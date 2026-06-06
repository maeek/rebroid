import { parseJsonStringArray } from "../policy/string-list";

const IPV4_ADDRESS =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

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

export const parseAllowCidrs = (value: string) =>
  parseJsonStringArray(value)
    .map((item) => normalizeIpv4Cidr(item))
    .filter((item): item is string => Boolean(item));
