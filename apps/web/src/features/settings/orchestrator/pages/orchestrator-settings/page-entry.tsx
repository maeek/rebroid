import { Suspense } from 'react'
import { SettingsPageSkeleton } from '@/shared/ui/settings/settings-page-skeleton'
import { OrchestratorSettingsForm } from '../../orchestrator-settings-form'
import { getOrchestratorSettingsPageData } from './page-data.server'

const OrchestratorSettingsContent = async () => {
  const { initialSettings } = await getOrchestratorSettingsPageData()

  return <OrchestratorSettingsForm initialSettings={initialSettings} />
}

export default function OrchestratorSettingsPageEntry() {
  return (
    <Suspense
      fallback={
        <SettingsPageSkeleton
          title='Settings'
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
