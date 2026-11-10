'use client'

import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { galleryPreviewApplications } from './apps-gallery-preview-data'
import { AppsList } from './apps-list'

export const AppsGalleryPreview = () => (
  <StandardPage>
    <AppsList
      canCreate
      canFilterByOwner
      yourApps={galleryPreviewApplications.map(app => ({
        ...mapAndroidApplicationToAppDefinition(app),
        ownerDisplayName: app.ownerUserId === 'another-owner' ? 'Operations team' : 'You'
      }))}
      currentOwnerUserId='preview-owner'
      initialSettings={defaultOrchestratorUiSettings}
    />
  </StandardPage>
)
