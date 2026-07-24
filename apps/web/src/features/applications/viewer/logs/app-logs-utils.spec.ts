import { describe, expect, it } from 'vitest'
import { isSourceUnavailableForApp } from './app-logs-utils'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const stoppedApp = {
  running: false,
  status: 'stopped',
  containerId: 'container_1'
} as AppDefinition

describe('isSourceUnavailableForApp', () => {
  it('keeps stopped-container logs available for crash diagnostics', () => {
    expect(isSourceUnavailableForApp(stoppedApp, 'container')).toBe(false)
    expect(isSourceUnavailableForApp(stoppedApp, 'adb')).toBe(true)
  })

  it('requires an existing container for container logs', () => {
    expect(isSourceUnavailableForApp({ ...stoppedApp, containerId: null }, 'container')).toBe(true)
  })
})
