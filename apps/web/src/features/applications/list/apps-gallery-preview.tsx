'use client'

import { toAppGalleryItem } from '@/shared/contracts/application-gallery'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { galleryPreviewApplications } from './apps-gallery-preview-data'
import { AppsList } from './apps-list'

export const AppsGalleryPreview = ({ withSnapshot = false }: { withSnapshot?: boolean }) => (
  <StandardPage gridToolbar>
    <AppsList
      canCreate
      canStart
      canStop
      canDelete
      canFilterByOwner
      canViewSnapshots={withSnapshot}
      yourApps={galleryPreviewApplications.map(app => ({
        ...toAppGalleryItem(app),
        ...(withSnapshot && app.id === 'gallery-app-1'
          ? { status: 'running' as const, lifecycleStage: 'ready' as const, running: true }
          : {})
      }))}
      currentOwnerUserId='preview-owner'
      initialSettings={defaultOrchestratorUiSettings}
    />
  </StandardPage>
)
