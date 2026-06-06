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
