import { GeneralSettingsForm } from '@/features/settings/general/general-settings-form'
import { requireAdmin } from '@/server/auth/authorization'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export default async function GeneralSettingsPage() {
  await requireAdmin()
  const initialSettings = await getServerOrchestratorUiSettings()

  return <GeneralSettingsForm initialSettings={initialSettings} />
}
