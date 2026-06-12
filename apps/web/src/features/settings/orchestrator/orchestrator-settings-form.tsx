'use client'

import { useEffect, useState } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { OrchestratorMaintenanceSection } from '@/features/settings/orchestrator/orchestrator-maintenance-section'
import { OrchestratorSettingsFieldsSection } from '@/features/settings/orchestrator/orchestrator-settings-fields-section'
import { OrchestratorSettingsHeader } from '@/features/settings/orchestrator/orchestrator-settings-header'
import { toast } from '@/hooks/use-toast'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import {
  resetOrchestratorUiSettings,
  saveOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import { StatusSplash } from '@/shared/ui/status-splash'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

type SaveOrchestratorUiSettingsInput = Pick<
  OrchestratorUiSettings,
  'defaultContainerImage' | 'dockerImageRegistry' | 'defaultInactivityTimeoutSeconds' | 'maxApkUploadSizeMb'
>

const persistOrchestratorUiSettings = saveOrchestratorUiSettings
const restoreOrchestratorUiSettings = resetOrchestratorUiSettings

type HealthState = 'checking' | 'online' | 'offline'

const toRuntimeUiSettings = (settings: OrchestratorUiSettings): SaveOrchestratorUiSettingsInput => ({
  defaultContainerImage: settings.defaultContainerImage,
  dockerImageRegistry: settings.dockerImageRegistry,
  defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: settings.maxApkUploadSizeMb
})

export const OrchestratorSettingsForm = ({ initialSettings }: { initialSettings: OrchestratorUiSettings }) => {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
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
      setSettings(current => ({ ...saved, orchestratorApiUrl: current.orchestratorApiUrl }))
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
      setSettings(current => ({ ...saved, orchestratorApiUrl: current.orchestratorApiUrl }))
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
        <div className='grid w-full gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]'>
          <OrchestratorSettingsFieldsSection
            settings={settings}
            onSettingsChange={updateSettings}
          />
          <OrchestratorMaintenanceSection />
        </div>
      </section>
    </ProtectedStackPageLayout>
  )
}
