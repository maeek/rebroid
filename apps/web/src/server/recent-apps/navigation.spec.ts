import { describe, expect, it } from 'vitest'
import { selectNavigationAppEntries, selectRecentlyOpenedAppEntries } from './navigation'

const app = (id: string, name: string, currentStatus: 'running' | 'stopped' = 'stopped') => ({
  id,
  name,
  currentStatus
})

describe('recent app navigation selection', () => {
  it('uses running apps by name, then top-five history candidates by name for remaining slots', () => {
    const apps = [
      app('z-running', 'Z Running', 'running'),
      app('a-running', 'A Running', 'running'),
      app('recent-c', 'Charlie'),
      app('recent-a', 'Alpha'),
      app('recent-e', 'Echo'),
      app('recent-b', 'Bravo'),
      app('recent-d', 'Delta'),
      app('old-a', 'Aardvark')
    ]
    const recent = [
      { id: 'recent-c', openedAt: 600 },
      { id: 'recent-a', openedAt: 500 },
      { id: 'recent-e', openedAt: 400 },
      { id: 'recent-b', openedAt: 300 },
      { id: 'recent-d', openedAt: 200 },
      { id: 'old-a', openedAt: 100 }
    ]

    expect(selectNavigationAppEntries(apps, recent).map(item => item.app.name)).toEqual([
      'A Running',
      'Z Running',
      'Alpha',
      'Bravo',
      'Charlie'
    ])
  })
})

describe('recently opened overview shortcuts', () => {
  it('preserves visit order and excludes deleted or inaccessible apps without adding unvisited running apps', () => {
    const apps = [app('older', 'Alpha'), app('newest', 'Zulu'), app('unvisited', 'Running', 'running')]
    const recent = [
      { id: 'older', openedAt: 100 },
      { id: 'hidden', openedAt: 400 },
      { id: 'newest', openedAt: 300 }
    ]
    expect(selectRecentlyOpenedAppEntries(apps, recent).map(item => item.app.id)).toEqual(['newest', 'older'])
    expect(selectRecentlyOpenedAppEntries(apps, [])).toEqual([])
  })

  it('caps the overview shortcuts at five', () => {
    const apps = Array.from({ length: 12 }, (_, index) => app(String(index), String(index)))
    const recent = apps.map((item, index) => ({ id: item.id, openedAt: index }))
    expect(selectRecentlyOpenedAppEntries(apps, recent).map(item => item.app.id)).toEqual(['11', '10', '9', '8', '7'])
  })
})
