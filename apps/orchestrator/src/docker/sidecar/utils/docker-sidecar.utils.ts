const ignoredBuildContextEntries = new Set([
  '.git',
  'node_modules',
  'dist',
  'npm-debug.log',
]);

export const shouldIgnoreBuildContextEntry = (name: string) =>
  ignoredBuildContextEntries.has(name);

export const isTransientAdbConnectionError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to connect') ||
    normalized.includes('unable to connect') ||
    normalized.includes('connection refused') ||
    normalized.includes('connection reset') ||
    normalized.includes('cannot connect') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('closed') ||
    normalized.includes('no route to host') ||
    normalized.includes('device offline')
  );
};

export const webrtcUdpPortBinding = (portRange: string) => {
  const [start, end] = portRange.split('-').map((value) => Number(value));
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start <= 0 ||
    end < start
  ) {
    return null;
  }

  const portBindings: Record<string, { HostIp: string; HostPort: string }[]> =
    {};
  const exposedPorts: Record<string, Record<string, never>> = {};
  for (let port = start; port <= end; port += 1) {
    const key = `${port}/udp`;
    portBindings[key] = [{ HostIp: '0.0.0.0', HostPort: String(port) }];
    exposedPorts[key] = {};
  }
  return { portBindings, exposedPorts };
};
