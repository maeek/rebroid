import { OrchestratorSettingsForm } from '@/features/settings/orchestrator/orchestrator-settings-form'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function OrchestratorSettingsPage() {
  const initialSettings = await getServerOrchestratorUiSettings()

  return <OrchestratorSettingsForm initialSettings={initialSettings} />
}
