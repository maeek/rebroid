import {
  isTransientAdbConnectionError,
  shouldIgnoreBuildContextEntry,
} from './docker-sidecar.utils';
import { hasDockerStatusCode } from './docker-engine.utils';

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
    expect(isTransientAdbConnectionError('device offline')).toBe(true);
    expect(isTransientAdbConnectionError('permanent authentication failure')).toBe(
      false,
    );
  });

  it('matches docker API style status codes on thrown objects', () => {
    expect(hasDockerStatusCode({ statusCode: 404 }, 404)).toBe(true);
    expect(hasDockerStatusCode({ statusCode: 500 }, 404)).toBe(false);
    expect(hasDockerStatusCode(new Error('boom'), 404)).toBe(false);
  });
});