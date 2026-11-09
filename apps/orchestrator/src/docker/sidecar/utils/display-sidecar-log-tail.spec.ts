import { displaySidecarLogTail } from './display-sidecar-log-tail';

describe('displaySidecarLogTail', () => {
  it('keeps the newest complete lines and strips terminal formatting', () => {
    const result = displaySidecarLogTail(
      'old\r\n\u001b[31mrecent\u001b[0m\r\n  newest\r\n',
      { lines: 2, bytes: 1024 },
    );
    expect(result).toEqual({
      output: 'recent\n  newest',
      lineLimit: 2,
      truncated: true,
    });
  });

  it('enforces the byte cap and prefers keeping complete lines', () => {
    const result = displaySidecarLogTail('old line\nrecent\nnewest', {
      lines: 20,
      bytes: 8,
    });
    expect(result).toEqual({
      output: 'newest',
      lineLimit: 20,
      truncated: true,
    });
  });

  it('caps an oversized final line at a UTF-8 boundary', () => {
    const result = displaySidecarLogTail('🚀🚀🚀', { lines: 20, bytes: 9 });
    expect(result).toEqual({ output: '🚀🚀', lineLimit: 20, truncated: true });
  });
});
