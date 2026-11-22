import { asRecord } from '../../../common/object-record';
import type { ServiceHealth } from '../../docker.types';

const stringField = (...values: unknown[]) =>
  values.find(
    (value): value is string =>
      typeof value === 'string' && value.trim() !== '',
  ) ?? null;

const booleanField = (...values: unknown[]) =>
  values.find((value): value is boolean => typeof value === 'boolean') ?? null;

const suitabilityIssue = (
  rootless: boolean,
  memoryLimit: boolean | null,
  operatingSystem: string | null,
) => {
  if (rootless)
    return 'Container engine is rootless. Redroid needs a rootful privileged Docker-compatible engine.';
  if (memoryLimit === false)
    return 'Container engine reports that memory limits are unavailable. Disable app memory limits or fix host cgroups before starting redroid.';
  if (operatingSystem?.toLowerCase().includes('docker desktop'))
    return 'Docker Desktop runs containers inside a VM. Redroid usually needs a native Linux host with binder devices exposed to a rootful privileged engine.';
  return null;
};

export const assessRuntimeSuitability = (info: unknown): ServiceHealth => {
  const engine = asRecord(info);
  const host = asRecord(engine?.host);
  const hostUpper = asRecord(engine?.Host);
  const securityOptions = Array.isArray(engine?.SecurityOptions)
    ? engine.SecurityOptions.filter(
        (value): value is string =>
          typeof value === 'string' && value.trim() !== '',
      )
    : [];
  const graphRoot = stringField(
    engine?.DockerRootDir,
    asRecord(engine?.Store)?.GraphRoot,
    asRecord(engine?.store)?.graphRoot,
  );
  const rootless = Boolean(
    booleanField(
      engine?.Rootless,
      asRecord(host?.security)?.rootless,
      asRecord(hostUpper?.Security)?.Rootless,
    ) ||
    securityOptions.some((option) =>
      option.toLowerCase().includes('rootless'),
    ) ||
    graphRoot?.includes('/.local/share/containers/storage'),
  );
  const memoryLimit = booleanField(
    engine?.MemoryLimit,
    hostUpper?.MemoryLimit,
    host?.memoryLimit,
  );
  const operatingSystem = stringField(engine?.OperatingSystem);
  const issue = suitabilityIssue(rootless, memoryLimit, operatingSystem);
  return {
    ok: issue === null,
    status: issue ? 'unhealthy' : 'healthy',
    message:
      issue ?? 'Container runtime is suitable for privileged app containers.',
    details: {
      rootless,
      operatingSystem,
      osType: stringField(engine?.OSType),
      architecture: stringField(engine?.Architecture),
      kernelVersion: stringField(engine?.KernelVersion),
      graphRoot,
      cgroupVersion: stringField(
        engine?.CgroupVersion,
        hostUpper?.CgroupVersion,
        host?.cgroupVersion,
      ),
      cgroupManager: stringField(
        engine?.CgroupDriver,
        hostUpper?.CgroupManager,
        host?.cgroupManager,
      ),
      memoryLimit,
      securityOptions: securityOptions.join(', ') || null,
    },
  };
};
