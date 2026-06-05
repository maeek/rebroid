import { describe, expect, it } from '@jest/globals'
import {
  formatByteStatsValue,
  formatContainerNetworks,
  formatContainerPorts,
  formatCpuStatsValue,
  getActionButtonLabel,
  isStatsRefreshDisabled
} from './container-detail-utils'

describe('orchestrator container detail utilities', () => {
  it('formats network and port summaries', () => {
    expect(formatContainerNetworks([])).toBe('none')
    expect(formatContainerNetworks(['app', 'bridge'])).toBe('app, bridge')
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
