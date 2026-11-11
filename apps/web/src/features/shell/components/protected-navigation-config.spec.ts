import { describe, expect, it } from 'vitest'
import { overviewSections, platformSections, isNavigationDestinationActive } from './protected-navigation-config'

describe('platform navigation', () => {
  it('keeps operational overview separate from administration', () => {
    expect(overviewSections.map(item => item.href)).toEqual(['/platform'])
    expect(platformSections.some(item => item.href === '/platform')).toBe(false)
  })
  it('orders platform settings by hierarchy and keeps display sessions inside services', () => {
    expect(platformSections.map(item => item.name)).toEqual([
      'Runtime defaults',
      'Services',
      'Features',
      'Scheduler',
      'AI'
    ])
    expect(platformSections.find(item => item.name === 'Features')?.href).toBe('/platform/features')
  })
  it('selects Features independently and keeps Services selected for display sessions', () => {
    expect(isNavigationDestinationActive('/platform/features', '/platform/features')).toBe(true)
    expect(isNavigationDestinationActive('/platform/features', '/platform/services')).toBe(false)
    expect(isNavigationDestinationActive('/platform/services/display-sessions', '/platform/services')).toBe(true)
    expect(isNavigationDestinationActive('/platform/runtime', '/platform/services')).toBe(false)
    expect(isNavigationDestinationActive('/platform/features', '/platform', true)).toBe(false)
  })
})
