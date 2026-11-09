import { normalizeIpv4Cidr } from "../cidr/ipv4-cidr";

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

const privateRanges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"].map(
  (cidr) => ipv4Range(cidr)!,
);
const broadPublicAddressCount = 2 ** 16;

export const allowsBroadInternetAccess = (cidrs: string[]) => {
  if (cidrs.some(isBroadInternetCidr)) {
    return true;
  }

  const ranges = cidrs
    .map(ipv4Range)
    .filter((range): range is NonNullable<typeof range> => Boolean(range))
    .sort((left, right) => left.start - right.start);
  let coveredThrough = -1;
  let publicAddresses = 0;
  for (const range of ranges) {
    const start = Math.max(range.start, coveredThrough + 1);
    if (start > range.end) continue;
    let addressCount = range.end - start + 1;
    for (const privateRange of privateRanges) {
      addressCount -= Math.max(
        0,
        Math.min(range.end, privateRange.end) -
          Math.max(start, privateRange.start) +
          1,
      );
    }
    publicAddresses += addressCount;
    if (publicAddresses >= broadPublicAddressCount) return true;
    coveredThrough = range.end;
  }

  return false;
};
