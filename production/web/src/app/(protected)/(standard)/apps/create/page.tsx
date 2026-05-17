import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { CreateAppForm } from './create-app-form'

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
