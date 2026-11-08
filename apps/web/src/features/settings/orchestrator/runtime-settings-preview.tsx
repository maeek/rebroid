'use client'
import { useState } from 'react'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { PlatformRuntimeFieldsSection } from './platform-runtime-fields-section'
import { PlatformRuntimeMaintenanceSection } from './platform-runtime-maintenance-section'
import { PlatformRuntimePageLayout } from './platform-runtime-page-layout'
import { PlatformRuntimePageSkeleton } from './platform-runtime-page-skeleton'

export const RuntimeSettingsPreview = ({ loading = false }: { loading?: boolean }) => {
  const [settings, setSettings] = useState(defaultOrchestratorUiSettings)
  const [saved, setSaved] = useState(settings)
  if (loading) return <PlatformRuntimePageSkeleton />
  return (
    <PlatformRuntimePageLayout
      hasChanges={JSON.stringify(settings) !== JSON.stringify(saved)}
      onDiscard={() => setSettings(saved)}
    >
      <form
        id='runtime-defaults-form'
        aria-label='Runtime defaults'
        onSubmit={event => {
          event.preventDefault()
          setSaved(settings)
        }}
      >
        <PlatformRuntimeFieldsSection
          images={[]}
          settings={settings}
          onSettingsChange={patch => setSettings(current => ({ ...current, ...patch }))}
        />
      </form>
      <PlatformRuntimeMaintenanceSection onRestore={() => {}} />
    </PlatformRuntimePageLayout>
  )
}
