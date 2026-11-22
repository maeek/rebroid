import os from 'node:os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getSystemStats } from './system-stats'

beforeEach(() => {
  vi.spyOn(os, 'uptime').mockReturnValue(3599.8)
  vi.spyOn(os, 'networkInterfaces').mockReturnValue({})
})

afterEach(() => vi.restoreAllMocks())

it('formats host metrics from one reading of each counter', () => {
  const model = { model: 'Example', speed: 2500, times: { idle: 10, user: 10, sys: 0, nice: 0, irq: 0 } }
  const cpus = vi.spyOn(os, 'cpus').mockReturnValueOnce([model]).mockReturnValue([])
  const total = vi.spyOn(os, 'totalmem').mockReturnValueOnce(1024).mockReturnValue(2048)
  const free = vi.spyOn(os, 'freemem').mockReturnValueOnce(256).mockReturnValue(512)
  expect(getSystemStats()).toMatchObject({
    cpu: 'Example',
    cpuCores: 1,
    totalMemory: '1 KB',
    totalMemoryBytes: 1024,
    freeMemory: '256 Bytes',
    freeMemoryBytes: 256,
    memoryUsage: '75.00%',
    uptime: '0h 59m 59s'
  })
  for (const read of [cpus, total, free]) expect(read).toHaveBeenCalledOnce()
})

it('returns a CPU label when the host has no CPU inventory', () => {
  vi.spyOn(os, 'cpus').mockReturnValue([])
  expect(getSystemStats()).toMatchObject({ cpu: 'Unavailable', cpuCores: 0 })
})
