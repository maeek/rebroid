import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { fullPermissions } from '@/shared/permissions/permissions'
import { EditorPage } from '@/shared/ui/page/editor-page'
import { CreateAppForm } from './create-app-form'

/** Uses the real form on the gated layout-contract route; no production entrypoint. */
export const CreateAppPreview = () => (
  <main className='min-h-screen bg-background pt-(--console-top-inset)'>
    <EditorPage
      width='full'
      className='gap-2'
    >
      <CreateAppForm
        images={[]}
        initialSettings={defaultOrchestratorUiSettings}
        permissions={fullPermissions}
        canBuildImages={false}
      />
    </EditorPage>
  </main>
)
