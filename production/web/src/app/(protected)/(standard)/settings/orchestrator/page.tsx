import { Suspense } from 'react'
import { SettingsPageSkeleton } from '@/features/settings/components/settings-page-skeleton'
import { OrchestratorSettingsForm } from '@/features/settings/orchestrator/orchestrator-settings-form'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

const OrchestratorSettingsContent = async () => {
  const initialSettings = await getServerOrchestratorUiSettings()

  return <OrchestratorSettingsForm initialSettings={initialSettings} />
}

export default function OrchestratorSettingsPage() {
  return (
    <Suspense
      fallback={
        <SettingsPageSkeleton
          title='Orchestrator'
          sectionTitle='Runtime'
          rows={4}
          variant='orchestrator'
        />
      }
    >
      <OrchestratorSettingsContent />
    </Suspense>
  )
}
