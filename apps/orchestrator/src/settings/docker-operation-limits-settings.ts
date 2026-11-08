import type { DockerOperationLimits } from '../docker/contracts/docker-operation-limits';

export const normalizeDockerOperationLimits = (
  value: unknown,
): DockerOperationLimits | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const bounds = {
    maxConcurrentReads: [1, 64],
    maxConcurrentLongOperations: [1, 16],
    slowRequestWarningMs: [100, 300_000],
    longOperationTimeoutMs: [1_000, 3_600_000],
  } as const;
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const number = record[key];
    if (
      typeof number !== 'number' ||
      !Number.isSafeInteger(number) ||
      number < min ||
      number > max
    )
      return undefined;
  }
  return {
    maxConcurrentReads: record.maxConcurrentReads as number,
    maxConcurrentLongOperations: record.maxConcurrentLongOperations as number,
    slowRequestWarningMs: record.slowRequestWarningMs as number,
    longOperationTimeoutMs: record.longOperationTimeoutMs as number,
  };
};
