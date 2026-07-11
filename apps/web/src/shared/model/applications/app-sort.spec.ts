import { describe, expect, it } from 'vitest'
import { sortApps } from './app-sort'

const apps = [
  { id: 'u14', name: 'U14', running: false },
  { id: 'm13', name: 'M13', running: true },
  { id: 'a16', name: 'A16', running: false },
  { id: 'h15', name: 'H15', running: true }
]

describe('app sorting', () => {
  it('sorts by name by default without grouping by running state', () => {
    expect(sortApps(apps, 'name-asc').map(app => app.name)).toEqual(['A16', 'H15', 'M13', 'U14'])
  })

  it('can sort running apps first while keeping each group stable by name', () => {
    expect(sortApps(apps, 'running-name').map(app => app.name)).toEqual(['H15', 'M13', 'A16', 'U14'])
  })
})
