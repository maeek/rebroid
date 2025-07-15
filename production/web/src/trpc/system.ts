import os from 'node:os'
import { protectedProcedure, router } from './trpc'

// In-memory store for the last 50 CPU usage percentages
const cpuUsagePercentLast50Entrires: [Date, number][] = []

function getCPUUsageOverInterval(interval = 1000) {
  const startTimes = os.cpus().map(cpu => cpu.times)

  setTimeout(() => {
    const endTimes = os.cpus().map(cpu => cpu.times)
    let totalStartIdle = 0
    let totalStartTick = 0
    let totalEndIdle = 0
    let totalEndTick = 0

    // Calculate the total start and end idle and ticks for all CPUs
    startTimes.forEach((start, index) => {
      const end = endTimes[index]

      totalStartIdle += start.idle
      totalStartTick += start.user + start.nice + start.sys + start.idle + start.irq
      totalEndIdle += end.idle
      totalEndTick += end.user + end.nice + end.sys + end.idle + end.irq
    })

    // Calculate the difference in idle and total times
    const idleDifference = totalEndIdle - totalStartIdle
    const totalDifference = totalEndTick - totalStartTick

    // CPU usage is 100% minus the idle time percentage
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

// Helper function to format uptime in hours, minutes, and seconds
function formatUptime(seconds: number) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs}h ${mins}m ${Math.ceil(secs)}s`
}

function getSystemStats() {
  return {
    platform: os.platform(),
    architecture: os.arch(),
    cpu: os.cpus().map(cpu => cpu.model)[0], // Model of the first CPU
    cpuCores: os.cpus().length,
    cpuUsage: `${os.loadavg()[0].toFixed(2)} (1 min avg)`, // System load for the last minute
    totalMemory: formatBytes(os.totalmem()),
    totalMemoryBytes: os.totalmem(),
    freeMemory: formatBytes(os.freemem()),
    freeMemoryBytes: os.freemem(),
    memoryUsage: `${((1 - os.freemem() / os.totalmem()) * 100).toFixed(2)}%`, // Memory usage percentage
    uptime: formatUptime(os.uptime()),
    networkInterfaces: os.networkInterfaces(),
    homeDirectory: os.homedir(),
    hostname: os.hostname(),
    cpuUsagePercentLast50Entrires
  }
}

export const systemRouter = router({
  getSystemStats: protectedProcedure.query(getSystemStats)
})

export type SystemRouter = typeof systemRouter
