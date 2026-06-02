import os from 'node:os'

export interface SystemStats {
  platform: string
  architecture: string
  cpu: string
  cpuCores: number
  cpuUsage: string
  totalMemory: string
  totalMemoryBytes: number
  freeMemory: string
  freeMemoryBytes: number
  memoryUsage: string
  uptime: string
  networkInterfaces: ReturnType<typeof os.networkInterfaces>
  homeDirectory: string
  hostname: string
  cpuUsagePercentLast50Entrires: [string, number][]
}

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

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function formatUptime(seconds: number) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs}h ${mins}m ${Math.ceil(secs)}s`
}

export function getSystemStats(): SystemStats {
  return {
    platform: os.platform(),
    architecture: os.arch(),
    cpu: os.cpus().map(cpu => cpu.model)[0],
    cpuCores: os.cpus().length,
    cpuUsage: `${os.loadavg()[0].toFixed(2)} (1 min avg)`,
    totalMemory: formatBytes(os.totalmem()),
    totalMemoryBytes: os.totalmem(),
    freeMemory: formatBytes(os.freemem()),
    freeMemoryBytes: os.freemem(),
    memoryUsage: `${((1 - os.freemem() / os.totalmem()) * 100).toFixed(2)}%`,
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
