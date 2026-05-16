import { getServerOrchestratorUiSettings } from '@/lib/orchestrator/server-settings'
import { OrchestratorSettingsForm } from './orchestrator-settings-form'

export default async function OrchestratorSettingsPage() {
  const initialSettings = await getServerOrchestratorUiSettings()

  return <OrchestratorSettingsForm initialSettings={initialSettings} />
}
