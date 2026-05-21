const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

export const readNestedValue = (value: unknown, path: string[]): unknown => {
  let current: unknown = value;

  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) {
      return undefined;
    }

    current = record[key];
  }

  return current;
};

export const readFirstString = (
  value: unknown,
  paths: string[][],
): string | null => {
  for (const path of paths) {
    const candidate = readNestedValue(value, path);
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
};

export const readFirstBoolean = (
  value: unknown,
  paths: string[][],
): boolean | null => {
  for (const path of paths) {
    const candidate = readNestedValue(value, path);
    if (typeof candidate === 'boolean') {
      return candidate;
    }
  }

  return null;
};

export const readStringArray = (value: unknown, path: string[]) => {
  const candidate = readNestedValue(value, path);
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
};

export const isRootlessContainerEngine = (info: unknown) => {
  const securityOptions = readStringArray(info, ['SecurityOptions']).map(
    (option) => option.toLowerCase(),
  );
  const graphRoot = readFirstString(info, [
    ['DockerRootDir'],
    ['Store', 'GraphRoot'],
    ['store', 'graphRoot'],
  ]);
  const explicitRootless = readFirstBoolean(info, [
    ['Rootless'],
    ['host', 'security', 'rootless'],
    ['Host', 'Security', 'Rootless'],
  ]);

  return Boolean(
    explicitRootless ||
    securityOptions.some((option) => option.includes('rootless')) ||
    graphRoot?.includes('/.local/share/containers/storage'),
  );
};
