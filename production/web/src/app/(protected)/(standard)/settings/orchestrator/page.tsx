import { requireAdmin } from '@/server/auth/authorization'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { OrchestratorSettingsForm } from './orchestrator-settings-form'

export default async function OrchestratorSettingsPage() {
  await requireAdmin()
  const initialSettings = await getServerOrchestratorUiSettings()

  return <OrchestratorSettingsForm initialSettings={initialSettings} />
}
