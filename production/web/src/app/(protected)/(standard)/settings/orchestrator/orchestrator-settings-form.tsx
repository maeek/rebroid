'use client'

import { useEffect, useState } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { StatusSplash } from '@/app/(protected)/_components/status-splash'
import { toast } from '@/hooks/use-toast'
import { getOrchestratorHealthAction } from '@/lib/orchestrator/actions'
import { resetOrchestratorUiSettings, saveOrchestratorUiSettings } from '@/lib/orchestrator/settings'
import { OrchestratorInventoryLinksSection } from './_components/orchestrator-inventory-links-section'
import { OrchestratorMaintenanceSection } from './_components/orchestrator-maintenance-section'
import { OrchestratorQuickGlanceSection } from './_components/orchestrator-quick-glance-section'
import { OrchestratorSettingsFieldsSection } from './_components/orchestrator-settings-fields-section'
import { OrchestratorSettingsHeader } from './_components/orchestrator-settings-header'
import type { OrchestratorUiSettings } from '@/lib/orchestrator/ui-settings'

type SaveOrchestratorUiSettingsInput = Pick<
  OrchestratorUiSettings,
  | 'defaultContainerImage'
  | 'defaultInactivityTimeoutSeconds'
  | 'maxApkUploadSizeMb'
  | 'imagePruneIntervalHours'
  | 'imagePruneDanglingOnly'
>

const persistOrchestratorUiSettings = saveOrchestratorUiSettings
const restoreOrchestratorUiSettings = resetOrchestratorUiSettings

type HealthState = 'checking' | 'online' | 'offline'

const toRuntimeUiSettings = (settings: OrchestratorUiSettings): SaveOrchestratorUiSettingsInput => ({
  defaultContainerImage: settings.defaultContainerImage,
  defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
  imagePruneIntervalHours: settings.imagePruneIntervalHours,
  imagePruneDanglingOnly: settings.imagePruneDanglingOnly
})

export const OrchestratorSettingsForm = ({ initialSettings }: { initialSettings: OrchestratorUiSettings }) => {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [maintenanceRefreshKey, setMaintenanceRefreshKey] = useState(0)
  const [healthState, setHealthState] = useState<HealthState>('checking')
  const [healthError, setHealthError] = useState<string | null>(null)

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  const checkHealth = async () => {
    setHealthState('checking')
    try {
      const health = await getOrchestratorHealthAction()
      if (!health.services.orchestrator.ok) {
        throw new Error(health.services.orchestrator.message || 'Could not reach the orchestrator.')
      }

      if (!health.services.docker.ok) {
        throw new Error(health.services.docker.message || 'The orchestrator API responded, but Docker is unavailable.')
      }

      setHealthError(null)
      setHealthState('online')
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : 'Could not reach the orchestrator.')
      setHealthState('offline')
    }
  }

  useEffect(() => {
    void checkHealth()
  }, [])

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
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
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
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (healthState !== 'online') {
    return (
      <ProtectedStackPageLayout mainClassName='gap-2'>
        <OrchestratorSettingsHeader
          isSaving={isSaving}
          onReset={() => void resetSettings()}
          onSave={() => void saveSettings()}
          showActions={false}
        />
        <section className='px-6 pb-16 pt-6 max-sm:px-4'>
          {healthState === 'checking' ? (
            <StatusSplash
              title='Checking orchestrator'
              description='Waiting for the API health check before loading Docker settings.'
              icon={<IconLoader2 className='size-10 animate-spin' />}
              className='min-h-[60vh]'
            />
          ) : (
            <StatusSplash
              title='Orchestrator unavailable'
              description='Docker settings and platform management are offline until the orchestrator responds.'
              detail={healthError}
              tone='danger'
              primaryAction={{ label: 'Refresh', onClick: () => void checkHealth() }}
              className='min-h-[60vh]'
            />
          )}
        </section>
      </ProtectedStackPageLayout>
    )
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
        <OrchestratorInventoryLinksSection />
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
