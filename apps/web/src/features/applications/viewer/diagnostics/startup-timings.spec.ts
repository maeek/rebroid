import { describe, expect, it } from 'vitest'
import { previewApp } from '@/features/applications/detail/app-resource-preview-data'
import { readStartupTimings, startupRuntimeKey } from './startup-timings'

const app = { ...previewApp, containerId: 'current', provisioningStartedAt: new Date('2026-11-13T00:59:27.000Z') }
const output = [
  '2026-11-12T00:59:27.100Z Container created {"containerId":"old"}',
  '2026-11-13T00:59:27.328Z Lifecycle stage: container_creating {}',
  '2026-11-13T00:59:27.416Z Container created {"containerId":"current"}',
  '2026-11-13T00:59:27.423Z Lifecycle stage: container_starting {}',
  '2026-11-13T00:59:28.023Z Container start requested {"containerId":"current"}',
  '2026-11-13T00:59:50.000Z Android network attachment completed {"outcome":"retry_after_boot"}',
  '2026-11-13T00:59:51.000Z Android boot completed {}',
  '2026-11-13T00:59:55.679Z Android network attachment completed {"outcome":"connected"}',
  '2026-11-13T00:59:57.000Z Prepared Android remote access {}',
  '2026-11-13T00:59:57.010Z Lifecycle stage: ready {}'
].join('\n')

describe('startup timings', () => {
  it('keeps boot and attachment milestones chronological without adding their overlapping durations', () => {
    const firstFrame = Date.parse('2026-11-13T01:00:03.668Z')
    const result = readStartupTimings(app, output, firstFrame)
    expect(result.baseline).toBe(Date.parse('2026-11-13T00:59:27.328Z'))
    expect(result.firstFrameAt! - result.baseline!).toBe(36_340)
    expect(result.milestones.map(item => item.label)).toEqual([
      'Container creation started',
      'Container created',
      'Container start requested',
      'Container started',
      'Android ready',
      'Display network attached',
      'ADB ready',
      'App ready',
      'First frame in this tab'
    ])
    expect(result.milestones.find(item => item.label === 'Display network attached')?.at).toBe(
      Date.parse('2026-11-13T00:59:55.679Z')
    )
  })
  it('does not reuse old startup timings after restarting the same container', () => {
    const restarted = { ...app, provisioningStartedAt: new Date('2026-11-14T00:00:00Z') }
    expect(startupRuntimeKey(restarted)).not.toBe(startupRuntimeKey(app))
    expect(readStartupTimings(restarted, output, Date.parse('2026-11-13T01:00:03Z'))).toEqual({
      baseline: null,
      firstFrameAt: null,
      milestones: []
    })
  })
  it('omits missing milestones, malformed lines and events from another container', () => {
    const result = readStartupTimings(
      app,
      [
        '2026-11-13T00:59:28.023Z Container created {"containerId":"other"}',
        '2026-11-13T00:59:28.024Z Android boot completed {truncated',
        'nonsense Container created {}'
      ].join('\n')
    )
    expect(result.baseline).toBeNull()
    expect(result.milestones).toEqual([])
  })
})
