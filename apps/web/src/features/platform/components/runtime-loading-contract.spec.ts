import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../..')
const runtimeRoutes = ['images', 'containers', 'networks']

describe('runtime loading architecture', () => {
  it.each(runtimeRoutes)('%s route loader is a thin feature export', route => {
    const source = readFileSync(resolve(root, `src/app/(protected)/(standard)/runtime/${route}/loading.tsx`), 'utf8')

    expect(source.trim().split('\n')).toHaveLength(1)
    expect(source).not.toContain('Skeleton')
    expect(source).not.toContain('columns')
    expect(source).not.toContain('minWidth')
  })

  it.each(runtimeRoutes)('%s page entry reuses the feature loading state', route => {
    const source = readFileSync(resolve(root, `src/features/platform/pages/runtime-${route}/page-entry.tsx`), 'utf8')

    expect(source).not.toContain('PlatformInventoryPageSkeleton')
    expect(source).not.toContain("kind: 'actions'")
    expect(source).not.toContain('minWidth=')
  })
})
