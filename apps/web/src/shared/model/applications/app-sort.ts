interface SortableApp {
  id: string
  name: string
  running: boolean
}

export type AppsListSortMode = 'name-asc' | 'name-desc' | 'running-name'

const appNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
})

export const compareAppNames = (left: Pick<SortableApp, 'id' | 'name'>, right: Pick<SortableApp, 'id' | 'name'>) => {
  const byName = appNameCollator.compare(left.name, right.name)
  return byName === 0 ? left.id.localeCompare(right.id) : byName
}

export const sortApps = <T extends SortableApp>(apps: T[], sortMode: AppsListSortMode) =>
  apps.toSorted((left, right) => {
    if (sortMode === 'running-name' && left.running !== right.running) {
      return left.running ? -1 : 1
    }

    const byName = compareAppNames(left, right)
    return sortMode === 'name-desc' ? byName * -1 : byName
  })
