import { Suspense } from 'react'
import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'
import { GeneralSettingsForm } from '@/features/settings/general/general-settings-form'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

const GeneralSettingsContent = async () => {
  const initialSettings = await getServerOrchestratorUiSettings()

  return <GeneralSettingsForm initialSettings={initialSettings} />
}

export default function GeneralSettingsPage() {
  return (
    <Suspense
      fallback={
        <SettingsPageSkeleton
          title='General'
          sectionTitle='Misc'
          rows={2}
        />
      }
    >
      <GeneralSettingsContent />
    </Suspense>
  )
}
