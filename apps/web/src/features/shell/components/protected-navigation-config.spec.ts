import { describe, expect, it } from 'vitest'
import { administrationEntries, isNavigationDestinationActive, overviewSections } from './protected-navigation-config'

describe('platform navigation', () => {
  it('keeps operational overview separate from administration', () => {
    expect(overviewSections.map(item => item.href)).toEqual(['/platform'])
    expect(administrationEntries.some(item => 'href' in item && item.href === '/platform')).toBe(false)
  })
  it('places Casting and Firewall after General and groups related resources', () => {
    expect(
      administrationEntries.map(item =>
        'items' in item ? [item.label, ...item.items.map(child => child.name)] : item.name
      )
    ).toEqual([
      'General',
      'Casting',
      'Firewall',
      'Feature management',
      'AI',
      ['Docker', 'Containers', 'Images', 'Networks'],
      ['Users & groups', 'Users', 'Groups'],
      'Audit log',
      ['System', 'Services', 'Resource usage', 'Maintenance tasks']
    ])
  })
  it('selects Features and Casting independently of Services', () => {
    expect(isNavigationDestinationActive('/platform/features', '/platform/features')).toBe(true)
    expect(isNavigationDestinationActive('/platform/features', '/platform/services')).toBe(false)
    expect(isNavigationDestinationActive('/platform/casting', '/platform/casting')).toBe(true)
    expect(isNavigationDestinationActive('/platform/casting', '/platform/services')).toBe(false)
    expect(isNavigationDestinationActive('/platform/runtime', '/platform/services')).toBe(false)
    expect(isNavigationDestinationActive('/platform/features', '/platform', true)).toBe(false)
  })
})
