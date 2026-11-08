import { describe, expect, it } from 'vitest'
import { overviewSections, platformSections, isNavigationDestinationActive } from './protected-navigation-config'

describe('platform navigation', () => {
  it('keeps operational overview separate from administration', () => {
    expect(overviewSections.map(item => item.href)).toEqual(['/platform'])
    expect(platformSections.some(item => item.href === '/platform')).toBe(false)
  })
  it('orders platform settings by hierarchy and keeps display sessions inside services', () => {
    expect(platformSections.map(item => item.name)).toEqual(['Runtime defaults', 'Services', 'Scheduler', 'AI'])
  })
  it('keeps Services selected for feature management and display sessions', () => {
    expect(isNavigationDestinationActive('/platform/features', '/platform/services')).toBe(true)
    expect(isNavigationDestinationActive('/platform/services/display-sessions', '/platform/services')).toBe(true)
    expect(isNavigationDestinationActive('/platform/runtime', '/platform/services')).toBe(false)
    expect(isNavigationDestinationActive('/platform/features', '/platform', true)).toBe(false)
  })
})
