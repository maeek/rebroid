import {
  extractHostname,
  networkPolicyChainName,
  normalizeIpv4Cidr,
  parseAllowCidrs,
  uniqueStrings,
} from './network-policy.utils';

describe('network policy utils', () => {
  it('normalizes IPv4 CIDRs and filters invalid allowlists', () => {
    expect(normalizeIpv4Cidr('10.0.0.5')).toBe('10.0.0.5/32');
    expect(normalizeIpv4Cidr('10.0.0.0/24')).toBe('10.0.0.0/24');
    expect(normalizeIpv4Cidr('10.0.0.0/99')).toBeNull();
    expect(parseAllowCidrs('["10.0.0.5", "bad", "192.168.0.0/24"]')).toEqual([
      '10.0.0.5/32',
      '192.168.0.0/24',
    ]);
  });

  it('extracts hostnames and normalizes network metadata helpers', () => {
    expect(extractHostname('https://example.com:3000/api')).toBe('example.com');
    expect(extractHostname('example.internal:8080')).toBe('example.internal');
    expect(extractHostname('')).toBeNull();
    expect(uniqueStrings(['a', 'b', 'a'])).toEqual(['a', 'b']);
    expect(networkPolicyChainName('12345678-1234-1234-1234-123456789abc')).toBe(
      'rebroid-123456781234123412341234',
    );
  });
});
