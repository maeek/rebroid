import type Dockerode from 'dockerode';

export const calculateContainerCpuUsagePercent = (
  stats: Dockerode.ContainerStats,
) => {
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage ?? 0) -
    (stats.precpu_stats?.system_cpu_usage ?? 0);

  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }

  return (cpuDelta / systemDelta) * 100;
};

export const calculateContainerMemoryUsageBytes = (
  stats: Dockerode.ContainerStats,
) => {
  const inactiveFile =
    stats.memory_stats?.stats?.total_inactive_file ??
    stats.memory_stats?.stats?.inactive_file ??
    0;
  return Math.max((stats.memory_stats?.usage ?? 0) - inactiveFile, 0);
};