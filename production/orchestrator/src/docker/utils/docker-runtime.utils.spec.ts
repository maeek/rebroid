import {
  calculateContainerCpuUsagePercent,
  calculateContainerMemoryUsageBytes,
} from './docker-runtime.utils';

describe('docker runtime utilities', () => {
  it('calculates cpu usage percent from docker stats deltas', () => {
    expect(
      calculateContainerCpuUsagePercent({
        cpu_stats: { cpu_usage: { total_usage: 300 }, system_cpu_usage: 1000 },
        precpu_stats: {
          cpu_usage: { total_usage: 100 },
          system_cpu_usage: 500,
        },
      } as never),
    ).toBe(40);
  });

  it('returns zero cpu usage when deltas are not positive', () => {
    expect(
      calculateContainerCpuUsagePercent({
        cpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000 },
        precpu_stats: {
          cpu_usage: { total_usage: 100 },
          system_cpu_usage: 500,
        },
      } as never),
    ).toBe(0);
  });

  it('calculates memory usage excluding inactive file pages', () => {
    expect(
      calculateContainerMemoryUsageBytes({
        memory_stats: {
          usage: 2048,
          stats: { total_inactive_file: 512 },
        },
      } as never),
    ).toBe(1536);

    expect(
      calculateContainerMemoryUsageBytes({
        memory_stats: {
          usage: 256,
          stats: { inactive_file: 512 },
        },
      } as never),
    ).toBe(0);
  });
});