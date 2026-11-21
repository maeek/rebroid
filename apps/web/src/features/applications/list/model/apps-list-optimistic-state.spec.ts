import { describe, expect, it } from 'vitest'
import { toAppGalleryItem } from '@/shared/contracts/application-gallery'
import { getAppStatusLabel } from '@/shared/model/applications/app-status-label'
import { galleryPreviewApplications } from '../apps-gallery-preview-data'
import { optimisticRemovingApp, optimisticStartingApp, optimisticStoppingApp } from './apps-list-optimistic-state'

const app = toAppGalleryItem({
  ...galleryPreviewApplications[0],
  status: 'running',
  lifecycleStage: 'ready'
})

describe('apps list optimistic state', () => {
  it.each([
    [optimisticStartingApp, 'provisioning', 'container_starting', 'Starting container'],
    [optimisticStoppingApp, 'stopped', 'stopping', 'Stopping'],
    [optimisticRemovingApp, 'removing', 'removing', 'Removing']
  ] as const)('updates the lifecycle state shown as %s', (update, status, lifecycleStage, label) => {
    const next = update(app)
    expect(next).toEqual({ ...app, running: false, status, lifecycleStage })
    expect(getAppStatusLabel(next.status, next.lifecycleStage)).toBe(label)
  })
})
