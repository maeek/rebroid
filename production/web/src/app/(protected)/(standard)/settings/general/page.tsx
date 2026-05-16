import { getServerOrchestratorUiSettings } from '@/lib/orchestrator/server-settings'
import { GeneralSettingsForm } from './general-settings-form'

export default async function GeneralSettingsPage() {
  const initialSettings = await getServerOrchestratorUiSettings()

  return <GeneralSettingsForm initialSettings={initialSettings} />
}
