import { describe, expect, it } from 'vitest'
import {
  formatByteStatsValue,
  formatContainerPorts,
  formatCpuStatsValue,
  getActionButtonLabel,
  isStatsRefreshDisabled
} from './container-detail-utils'

describe('orchestrator container detail utilities', () => {
  it('formats port summaries', () => {
    expect(formatContainerPorts([{ ip: null, publicPort: 8080, privatePort: 80, type: 'tcp' }])).toBe(
      '*:8080 -> 80/tcp'
    )
  })

  it('formats stats values and refresh disabled state', () => {
    expect(formatCpuStatsValue({ cpuUsagePercent: 12.345 } as never)).toBe('12.3%')
    expect(formatByteStatsValue(undefined)).toBe('Unavailable')
    expect(isStatsRefreshDisabled('running', false)).toBe(false)
    expect(isStatsRefreshDisabled('exited', false)).toBe(true)
  })

  it('labels remove actions with force state', () => {
    expect(getActionButtonLabel('stop', false)).toBe('Stop container')
    expect(getActionButtonLabel('remove', false)).toBe('Remove container')
    expect(getActionButtonLabel('remove', true)).toBe('Force remove container')
  })
})
