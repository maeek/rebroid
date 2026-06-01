import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/features/shell/components/protected-page-shell'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function CreateAppPage() {
  const [initialSettings, user] = await Promise.all([getServerOrchestratorUiSettings(), getCurrentUserContext()])

  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <CreateAppForm
          initialSettings={initialSettings}
          permissions={user.permissions}
        />
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
