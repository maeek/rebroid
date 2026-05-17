import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { GeneralSettingsForm } from './general-settings-form'

export default async function GeneralSettingsPage() {
  const initialSettings = await getServerOrchestratorUiSettings()

  return <GeneralSettingsForm initialSettings={initialSettings} />
}
