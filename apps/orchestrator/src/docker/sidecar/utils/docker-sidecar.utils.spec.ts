import {
  isTransientAdbConnectionError,
  shouldIgnoreBuildContextEntry,
} from './docker-sidecar.utils';

describe('docker utility helpers', () => {
  it('ignores known sidecar build context entries', () => {
    expect(shouldIgnoreBuildContextEntry('.git')).toBe(true);
    expect(shouldIgnoreBuildContextEntry('node_modules')).toBe(true);
    expect(shouldIgnoreBuildContextEntry('src')).toBe(false);
  });

  it('detects transient adb connection failures case-insensitively', () => {
    expect(isTransientAdbConnectionError('FAILED TO CONNECT to device')).toBe(
      true,
    );
    expect(
      isTransientAdbConnectionError('unable to connect to 10.1.0.3:5555'),
    ).toBe(true);
    expect(isTransientAdbConnectionError('device offline')).toBe(true);
    expect(
      isTransientAdbConnectionError('permanent authentication failure'),
    ).toBe(false);
  });
});
