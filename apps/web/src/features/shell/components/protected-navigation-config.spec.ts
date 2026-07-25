import { describe, expect, it } from 'vitest'
import { platformSections } from './protected-navigation-config'

describe('platform navigation', () => {
  it('orders platform settings by hierarchy and keeps display sessions inside services', () => {
    expect(platformSections.map(item => item.name)).toEqual([
      'Overview',
      'Runtime defaults',
      'Features',
      'Services',
      'Scheduler',
      'AI'
    ])
  })
})
