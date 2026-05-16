'use client'

import { useEffect, useState } from 'react'
import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import { resetOrchestratorUiSettings, saveOrchestratorUiSettings } from '@/lib/orchestrator/settings'
import { OrchestratorMaintenanceSection } from './_components/orchestrator-maintenance-section'
import { OrchestratorQuickGlanceSection } from './_components/orchestrator-quick-glance-section'
import { OrchestratorSettingsFieldsSection } from './_components/orchestrator-settings-fields-section'
import { OrchestratorSettingsHeader } from './_components/orchestrator-settings-header'
import type { OrchestratorUiSettings } from '@/lib/orchestrator/ui-settings'

type SaveOrchestratorUiSettingsInput = Pick<
  OrchestratorUiSettings,
  | 'defaultRedroidImage'
  | 'defaultInactivityTimeoutSeconds'
  | 'maxApkUploadSizeMb'
  | 'imagePruneIntervalHours'
  | 'imagePruneDanglingOnly'
>

const persistOrchestratorUiSettings = saveOrchestratorUiSettings
const restoreOrchestratorUiSettings = resetOrchestratorUiSettings

const toRuntimeUiSettings = (settings: OrchestratorUiSettings): SaveOrchestratorUiSettingsInput => ({
  defaultRedroidImage: settings.defaultRedroidImage,
  defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
  imagePruneIntervalHours: settings.imagePruneIntervalHours,
  imagePruneDanglingOnly: settings.imagePruneDanglingOnly
})

export const OrchestratorSettingsForm = ({ initialSettings }: { initialSettings: OrchestratorUiSettings }) => {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [maintenanceRefreshKey, setMaintenanceRefreshKey] = useState(0)

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  const updateSettings = (patch: Partial<OrchestratorUiSettings>) => {
    setSettings(current => ({ ...current, ...patch }))
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const runtimeSettings: SaveOrchestratorUiSettingsInput = toRuntimeUiSettings(settings)
      const saved: OrchestratorUiSettings = await persistOrchestratorUiSettings(runtimeSettings)
      setSettings(saved)
      toast({ title: 'Settings saved' })
    } catch (error) {
      toast({ title: 'Could not save settings', description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsSaving(false)
    }
  }

  const resetSettings = async () => {
    setIsSaving(true)
    try {
      const saved: OrchestratorUiSettings = await restoreOrchestratorUiSettings()
      setSettings(saved)
      toast({ title: 'Settings reset' })
    } catch (error) {
      toast({
        title: 'Could not reset settings',
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <OrchestratorSettingsHeader
        isSaving={isSaving}
        onReset={() => void resetSettings()}
        onSave={() => void saveSettings()}
      />
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <OrchestratorQuickGlanceSection refreshKey={maintenanceRefreshKey} />
        <div className='grid w-full gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]'>
          <OrchestratorSettingsFieldsSection
            settings={settings}
            onSettingsChange={updateSettings}
          />
          <OrchestratorMaintenanceSection
            imagePruneDanglingOnly={settings.imagePruneDanglingOnly}
            onMaintenanceComplete={() => setMaintenanceRefreshKey(current => current + 1)}
          />
        </div>
      </section>
    </ProtectedStackPageLayout>
  )
}
