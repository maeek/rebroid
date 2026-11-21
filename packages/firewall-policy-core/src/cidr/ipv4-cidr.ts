import { parseJsonStringArray } from "../policy/string-list";

const IPV4_ADDRESS =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export const normalizeIpv4Cidr = (value: string) => {
  const [address, prefix = "32", extra] = value.trim().split("/");
  if (
    extra !== undefined ||
    !IPV4_ADDRESS.test(address) ||
    !/^\d{1,2}$/.test(prefix)
  ) {
    return null;
  }

  const numericPrefix = Number(prefix);
  return numericPrefix <= 32 ? `${address}/${numericPrefix}` : null;
};

export const parseAllowCidrs = (value: string) =>
  parseJsonStringArray(value)
    .map((item) => normalizeIpv4Cidr(item))
    .filter((item): item is string => Boolean(item));
