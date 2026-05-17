import { OrchestratorSettingsForm } from '@/features/settings/orchestrator/orchestrator-settings-form'
import { requireAdmin } from '@/server/auth/authorization'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function OrchestratorSettingsPage() {
  await requireAdmin()
  const initialSettings = await getServerOrchestratorUiSettings()

  return <OrchestratorSettingsForm initialSettings={initialSettings} />
}
