import { getServerOrchestratorUiSettings } from '@/lib/orchestrator/server-settings'
import { requireAdmin } from '@/server/auth/authorization'
import { OrchestratorSettingsForm } from './orchestrator-settings-form'

export default async function OrchestratorSettingsPage() {
  await requireAdmin()
  const initialSettings = await getServerOrchestratorUiSettings()

  return <OrchestratorSettingsForm initialSettings={initialSettings} />
}
