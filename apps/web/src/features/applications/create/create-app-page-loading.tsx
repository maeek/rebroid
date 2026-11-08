'use client'

import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { fullPermissions } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { CreateAppForm } from './create-app-form'

export const CreateAppPageLoading = () => (
  <FormLoadingBoundary>
    <EditorPage
      width='full'
      className='gap-2'
    >
      <CreateAppForm
        images={[]}
        initialSettings={defaultOrchestratorUiSettings}
        permissions={fullPermissions}
        canBuildImages={false}
        loading
      />
    </EditorPage>
  </FormLoadingBoundary>
)
