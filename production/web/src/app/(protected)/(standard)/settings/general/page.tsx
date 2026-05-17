import { GeneralSettingsForm } from '@/features/settings/general/general-settings-form'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function GeneralSettingsPage() {
  const initialSettings = await getServerOrchestratorUiSettings()

  return <GeneralSettingsForm initialSettings={initialSettings} />
}
