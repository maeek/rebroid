import os from 'node:os'
import type { SystemStats } from '@/shared/contracts/system-stats'

type CpuTimes = ReturnType<typeof os.cpus>[number]['times']

interface SystemStatsSampler {
  previousCpuTimes?: CpuTimes[]
  samples: [Date, number][]
  interval?: ReturnType<typeof setInterval>
}

declare global {
  // Keep one sampler across Next dev module reloads.
  var __rebroidSystemStatsSampler: SystemStatsSampler | undefined
}

const sampler = (globalThis.__rebroidSystemStatsSampler ??= {
  samples: []
})

function totalCpuTicks(times: CpuTimes) {
  return times.user + times.nice + times.sys + times.idle + times.irq
}

function sampleCpuUsage() {
  const currentCpuTimes = os.cpus().map(cpu => cpu.times)
  const previousCpuTimes = sampler.previousCpuTimes
  sampler.previousCpuTimes = currentCpuTimes

  if (!previousCpuTimes) {
    return
  }

  let totalPreviousIdle = 0
  let totalPreviousTick = 0
  let totalCurrentIdle = 0
  let totalCurrentTick = 0

  previousCpuTimes.forEach((previous, index) => {
    const current = currentCpuTimes[index]

    if (!current) {
      return
    }

    totalPreviousIdle += previous.idle
    totalPreviousTick += totalCpuTicks(previous)
    totalCurrentIdle += current.idle
    totalCurrentTick += totalCpuTicks(current)
  })

  const idleDifference = totalCurrentIdle - totalPreviousIdle
  const totalDifference = totalCurrentTick - totalPreviousTick

  if (totalDifference <= 0) {
    return
  }

  const cpuUsage = (1 - idleDifference / totalDifference) * 100

  sampler.samples.push([new Date(), +cpuUsage.toFixed(2)])

  if (sampler.samples.length > 50) {
    sampler.samples.shift()
  }
}

if (!sampler.interval) {
  sampleCpuUsage()
  sampler.interval = setInterval(sampleCpuUsage, 1000)
  sampler.interval.unref?.()
}

const byteUnits = ['Bytes', 'KB', 'MB', 'GB', 'TB']

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), byteUnits.length - 1)
  return `${Number((bytes / 1024 ** index).toFixed(2))} ${byteUnits[index]}`
}

function formatUptime(seconds: number) {
  const elapsed = Math.floor(seconds)
  return `${Math.floor(elapsed / 3600)}h ${Math.floor(elapsed / 60) % 60}m ${elapsed % 60}s`
}

export function getSystemStats(): SystemStats {
  const cpus = os.cpus()
  const totalMemoryBytes = os.totalmem()
  const freeMemoryBytes = os.freemem()
  return {
    platform: os.platform(),
    architecture: os.arch(),
    cpu: cpus[0]?.model ?? 'Unavailable',
    cpuCores: cpus.length,
    cpuUsage: `${os.loadavg()[0].toFixed(2)} (1 min avg)`,
    totalMemory: formatBytes(totalMemoryBytes),
    totalMemoryBytes,
    freeMemory: formatBytes(freeMemoryBytes),
    freeMemoryBytes,
    memoryUsage: `${((1 - freeMemoryBytes / totalMemoryBytes) * 100).toFixed(2)}%`,
    uptime: formatUptime(os.uptime()),
    networkInterfaces: os.networkInterfaces(),
    homeDirectory: os.homedir(),
    hostname: os.hostname(),
    cpuUsagePercentLast50Entrires: sampler.samples.map(([time, cpuUsagePercent]) => [
      time.toISOString(),
      cpuUsagePercent
    ])
  }
}
