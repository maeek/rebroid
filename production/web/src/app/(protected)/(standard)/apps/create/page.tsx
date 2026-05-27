import { CreateAppForm } from '@/features/applications/create/create-app-form'
import { ProtectedSplitPageContent, ProtectedSplitPageLayout } from '@/features/shell/components/protected-page-shell'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getResourceLimitBoundsAction } from '@/server/orchestrator/diagnostics/actions'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function CreateAppPage() {
  const initialSettings = await getServerOrchestratorUiSettings()
  const user = await getCurrentUserContext()
  const resourceLimits = await getResourceLimitBoundsAction().catch(() => null)

  return (
    <ProtectedSplitPageLayout>
      <ProtectedSplitPageContent>
        <CreateAppForm
          initialSettings={initialSettings}
          resourceLimits={resourceLimits}
          permissions={user.permissions}
        />
      </ProtectedSplitPageContent>
    </ProtectedSplitPageLayout>
  )
}
