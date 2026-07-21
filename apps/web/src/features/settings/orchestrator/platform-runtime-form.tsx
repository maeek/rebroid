'use client'

import { useEffect, useState } from 'react'
import { PlatformRuntimeFieldsSection } from '@/features/settings/orchestrator/platform-runtime-fields-section'
import { PlatformRuntimeHeader } from '@/features/settings/orchestrator/platform-runtime-header'
import { PlatformRuntimeMaintenanceSection } from '@/features/settings/orchestrator/platform-runtime-maintenance-section'
import { toast } from '@/hooks/use-toast'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import {
  resetOrchestratorUiSettings,
  saveOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { StateView } from '@/shared/ui/state-view'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

type SaveOrchestratorUiSettingsInput = Pick<
  OrchestratorUiSettings,
  | 'defaultContainerImage'
  | 'dockerImageRegistry'
  | 'defaultInactivityTimeoutSeconds'
  | 'maxApkUploadSizeMb'
  | 'removeDataOnDelete'
  | 'services'
>

const persistOrchestratorUiSettings = saveOrchestratorUiSettings
const restoreOrchestratorUiSettings = resetOrchestratorUiSettings

type HealthState = 'checking' | 'online' | 'offline'

const toRuntimeUiSettings = (settings: OrchestratorUiSettings): SaveOrchestratorUiSettingsInput => ({
  defaultContainerImage: settings.defaultContainerImage,
  dockerImageRegistry: settings.dockerImageRegistry,
  defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
  removeDataOnDelete: settings.removeDataOnDelete,
  services: settings.services
})

export const PlatformRuntimeForm = ({
  images,
  initialSettings
}: {
  images: PlatformImage[]
  initialSettings: OrchestratorUiSettings
}) => {
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
      toast({ title: 'Settings saved', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
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
      toast({ title: 'Settings reset', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not reset settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (healthState !== 'online') {
    return (
      <StandardPage className='gap-2'>
        <PlatformRuntimeHeader
          isSaving={isSaving}
          onReset={() => void resetSettings()}
          onSave={() => void saveSettings()}
          showActions={false}
        />
        <PageContent>
          {healthState === 'checking' ? (
            <StateView
              kind='loading'
              title='Checking orchestrator'
              description='Waiting for the API health check before loading Docker settings.'
            />
          ) : (
            <StateView
              kind='unavailable'
              title='Orchestrator unavailable'
              description='Docker settings and platform management are offline until the orchestrator responds.'
              detail={healthError ? 'Check the orchestrator service and Docker, then try again.' : undefined}
              actions={[{ label: 'Try again', onClick: () => void checkHealth() }]}
            />
          )}
        </PageContent>
      </StandardPage>
    )
  }

  return (
    <StandardPage className='gap-2'>
      <PlatformRuntimeHeader
        isSaving={isSaving}
        onReset={() => void resetSettings()}
        onSave={() => void saveSettings()}
      />
      <PageContent>
        <div className='grid w-full items-start gap-6 xl:grid-cols-2'>
          <PlatformRuntimeFieldsSection
            images={images}
            settings={settings}
            onSettingsChange={updateSettings}
          />
          <PlatformRuntimeMaintenanceSection />
        </div>
      </PageContent>
    </StandardPage>
  )
}
