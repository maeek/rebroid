import type { AdbTargetPreparation } from '../../../docker/contracts/docker-sidecar.port';

export type PreparedViewerTargetEntry<Target> = {
  appId: string;
  runtime: string;
  target: Target;
  generation: number;
  expiresAt: number;
};

export function isPreparedViewerTargetExpired(
  entry: Pick<PreparedViewerTargetEntry<unknown>, 'expiresAt' | 'generation'>,
  now: number,
  generation: number,
) {
  return entry.expiresAt <= now || entry.generation !== generation;
}

export function selectPreparedViewerTarget<Target extends { adbHost: string }>(
  entries: ReadonlyMap<string, PreparedViewerTargetEntry<Target>>,
  {
    appId,
    runtime,
    containerStartedAt,
    purpose,
    observedHost,
    now,
    generation,
  }: {
    appId: string;
    runtime: string;
    containerStartedAt?: string;
    purpose: AdbTargetPreparation;
    observedHost?: string;
    now: number;
    generation: number;
  },
) {
  const targetKey = (kind: AdbTargetPreparation, host?: string) =>
    JSON.stringify([runtime, containerStartedAt, kind, host]);
  const key = targetKey(purpose, observedHost);
  const obsoleteKeys = new Set<string>();
  for (const [cachedKey, entry] of entries) {
    const mismatchedTarget =
      entry.appId === appId &&
      (entry.runtime !== runtime ||
        (observedHost !== undefined && entry.target.adbHost !== observedHost));
    if (
      isPreparedViewerTargetExpired(entry, now, generation) ||
      mismatchedTarget
    ) {
      obsoleteKeys.add(cachedKey);
    }
  }

  const candidates = [key];
  if (purpose === 'transport') {
    if (observedHost !== undefined) candidates.push(targetKey('transport'));
    candidates.push(targetKey('interactive'));
  }
  for (const candidate of candidates) {
    const entry = entries.get(candidate);
    if (entry && !obsoleteKeys.has(candidate)) {
      return { key, obsoleteKeys, target: entry.target };
    }
  }
  return { key, obsoleteKeys, target: undefined };
}
