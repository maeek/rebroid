import { describe, expect, it } from 'vitest'
import { selectNavigationAppEntries } from './navigation'

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
