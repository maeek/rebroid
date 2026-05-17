import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/features/shell/components/protected-page-shell'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function CreateAppPage() {
  const initialSettings = await getServerOrchestratorUiSettings()

  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <CreateAppForm initialSettings={initialSettings} />
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
