import { getErrorMessage } from './error-message';
import { parseJsonStringArray } from './json-array';
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
    expect(
      parseJsonStringArray('["10.0.0.1/32", 123, "192.168.0.0/24"]'),
    ).toEqual(['10.0.0.1/32', '192.168.0.0/24']);
    expect(parseJsonStringArray('{"cidrs":[]}')).toEqual([]);
    expect(parseJsonStringArray('invalid json')).toEqual([]);
  });

  it('formats errors and thrown strings with a configurable fallback', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('boom')).toBe('boom');
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
});
