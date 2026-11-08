import { describe, expect, it } from 'vitest'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { applicationPreview } from '@/shared/testing/application-preview'
import { filterGalleryApps } from './apps-gallery-filter'
import { deriveAppsListSelection, retainVisibleSelectedIds } from './apps-list-selection'

const base = mapAndroidApplicationToAppDefinition(applicationPreview)
const apps = [
  {
    ...base,
    id: 'warehouse',
    name: 'Warehouse',
    apkPackageName: 'com.inventory.scan',
    status: 'running' as const,
    running: true
  },
  { ...base, id: 'checkout', name: 'Checkout', ownerDisplayName: 'Retail', status: 'error' as const },
  { ...base, id: 'starting', name: 'Starting', status: 'provisioning' as const },
  { ...base, id: 'stopping', name: 'Stopping', lifecycleStage: 'stopping' as const }
]

describe('gallery discovery and selection', () => {
  it('combines search with status and searches package and owner metadata', () => {
    expect(filterGalleryApps(apps, ' COM.INVENTORY ', 'running').map(app => app.id)).toEqual(['warehouse'])
    expect(filterGalleryApps(apps, 'retail', 'error').map(app => app.id)).toEqual(['checkout'])
    expect(filterGalleryApps(apps, 'retail', 'running')).toEqual([])
    expect(filterGalleryApps(apps, '', 'working').map(app => app.id)).toEqual(['starting', 'stopping'])
  })
  it('never includes hidden selections in bulk operations', () => {
    const visible = filterGalleryApps(apps, '', 'error')
    const selectedIds = retainVisibleSelectedIds(visible, new Set(apps.map(app => app.id)))
    const result = deriveAppsListSelection({
      apps: visible,
      selectedIds,
      currentOwnerUserId: base.ownerUserId!,
      bulkAction: 'delete'
    })
    expect(result.activeBulkApps.map(app => app.id)).toEqual(['checkout'])
    expect(result.allSelected).toBe(true)
  })
})
