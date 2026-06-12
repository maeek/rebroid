import {
  isTransientAdbConnectionError,
  shouldIgnoreBuildContextEntry,
  webrtcUdpPortBinding,
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

  it('builds WebRTC UDP port bindings from a valid range', () => {
    expect(webrtcUdpPortBinding('40000-40002')).toEqual({
      portBindings: {
        '40000/udp': [{ HostIp: '0.0.0.0', HostPort: '40000' }],
        '40001/udp': [{ HostIp: '0.0.0.0', HostPort: '40001' }],
        '40002/udp': [{ HostIp: '0.0.0.0', HostPort: '40002' }],
      },
      exposedPorts: {
        '40000/udp': {},
        '40001/udp': {},
        '40002/udp': {},
      },
    });
  });

  it('rejects invalid WebRTC UDP port ranges', () => {
    expect(webrtcUdpPortBinding('')).toBeNull();
    expect(webrtcUdpPortBinding('40002-40000')).toBeNull();
    expect(webrtcUdpPortBinding('0-1')).toBeNull();
    expect(webrtcUdpPortBinding('abc-def')).toBeNull();
  });
});
