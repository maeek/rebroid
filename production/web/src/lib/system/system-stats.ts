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

const cpuUsagePercentLast50Entrires: [Date, number][] = []

function getCPUUsageOverInterval(interval = 1000) {
  const startTimes = os.cpus().map(cpu => cpu.times)

  setTimeout(() => {
    const endTimes = os.cpus().map(cpu => cpu.times)
    let totalStartIdle = 0
    let totalStartTick = 0
    let totalEndIdle = 0
    let totalEndTick = 0

    startTimes.forEach((start, index) => {
      const end = endTimes[index]

      totalStartIdle += start.idle
      totalStartTick += start.user + start.nice + start.sys + start.idle + start.irq
      totalEndIdle += end.idle
      totalEndTick += end.user + end.nice + end.sys + end.idle + end.irq
    })

    const idleDifference = totalEndIdle - totalStartIdle
    const totalDifference = totalEndTick - totalStartTick
    const cpuUsage = (1 - idleDifference / totalDifference) * 100

    cpuUsagePercentLast50Entrires.push([new Date(), +cpuUsage.toFixed(2)])

    if (cpuUsagePercentLast50Entrires.length > 50) {
      cpuUsagePercentLast50Entrires.shift()
    }
  }, interval)
}

setInterval(() => {
  getCPUUsageOverInterval(1000)
}, 1000)

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
    cpuUsagePercentLast50Entrires: cpuUsagePercentLast50Entrires.map(([time, cpuUsagePercent]) => [
      time.toISOString(),
      cpuUsagePercent
    ])
  }
}
