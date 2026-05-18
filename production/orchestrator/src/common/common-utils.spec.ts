import { getErrorMessage } from './error-message';
import { parseJsonStringArray } from './json-array';
import {
  extractHostname,
  networkPolicyChainName,
  normalizeIpv4Cidr,
  parseAllowCidrs,
  uniqueStrings,
} from './network-policy';
import { numberInRange } from './number-range';
import { formatUnderscoreLabel } from './string-format';

describe('common utilities', () => {
  it('formats underscore-delimited labels for display', () => {
    expect(formatUnderscoreLabel('android_booting')).toBe('Android Booting');
    expect(formatUnderscoreLabel('__network_creating__')).toBe(
      'Network Creating',
    );
  });

  it('parses JSON string arrays defensively', () => {
    expect(parseJsonStringArray('["10.0.0.1/32", 123, "192.168.0.0/24"]')).toEqual([
      '10.0.0.1/32',
      '192.168.0.0/24',
    ]);
    expect(parseJsonStringArray('{"cidrs":[]}')).toEqual([]);
    expect(parseJsonStringArray('invalid json')).toEqual([]);
  });

  it('formats unknown errors with a configurable fallback', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('boom')).toBe('Unknown error');
    expect(getErrorMessage(null, 'Unknown Docker error')).toBe(
      'Unknown Docker error',
    );
  });

  it('clamps numbers into an integer range', () => {
    expect(numberInRange('120', 10, 60, 300)).toBe(120);
    expect(numberInRange(12.9, 10, 0, 100)).toBe(12);
    expect(numberInRange('invalid', 10, 0, 100)).toBe(10);
    expect(numberInRange(999, 10, 0, 100)).toBe(100);
  });

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
      'SMA-123456781234123412341234',
    );
  });
});