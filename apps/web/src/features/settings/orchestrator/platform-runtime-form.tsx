'use client'

import { useEffect, useRef, useState } from 'react'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { PlatformRuntimeFieldsSection } from '@/features/settings/orchestrator/platform-runtime-fields-section'
import { PlatformRuntimeMaintenanceSection } from '@/features/settings/orchestrator/platform-runtime-maintenance-section'
import { toast } from '@/hooks/use-toast'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import {
  resetOrchestratorUiSettings,
  saveOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import { StateView } from '@/shared/ui/state-view'
import { PlatformRuntimePageLayout } from './platform-runtime-page-layout'
import { PlatformRuntimePageSkeleton } from './platform-runtime-page-skeleton'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings, RuntimeAdminUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const runtimeSettingsInput = (settings: OrchestratorUiSettings): Omit<RuntimeAdminUiSettings, 'services'> => ({
  defaultContainerImage: settings.defaultContainerImage,
  dockerImageRegistry: settings.dockerImageRegistry,
  defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
  removeDataOnDelete: settings.removeDataOnDelete
})

export const PlatformRuntimeForm = ({
  images,
  initialSettings
}: {
  images: PlatformImage[]
  initialSettings: OrchestratorUiSettings
}) => {
  const [form, setForm] = useState({ settings: initialSettings, savedSettings: initialSettings })
  const { settings, savedSettings } = form
  const [operation, setOperation] = useState<'save' | 'restore' | null>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [healthState, setHealthState] = useState<'checking' | 'online' | 'offline'>('checking')
  const initialSnapshot = useRef(JSON.stringify(initialSettings))
  const hasChanges =
    JSON.stringify(runtimeSettingsInput(settings)) !== JSON.stringify(runtimeSettingsInput(savedSettings))
  const isBusy = operation !== null

  useEffect(() => {
    const snapshot = JSON.stringify(initialSettings)
    if (initialSnapshot.current === snapshot) return
    initialSnapshot.current = snapshot
    setForm(current => {
      const dirty =
        JSON.stringify(runtimeSettingsInput(current.settings)) !==
        JSON.stringify(runtimeSettingsInput(current.savedSettings))
      return { settings: dirty ? current.settings : initialSettings, savedSettings: initialSettings }
    })
  }, [initialSettings])

  const checkHealth = async () => {
    setHealthState('checking')
    try {
      const health = await getOrchestratorHealthAction()
      setHealthState(health.services.orchestrator.ok && health.services.docker.ok ? 'online' : 'offline')
    } catch {
      setHealthState('offline')
    }
  }
  useEffect(() => {
    void checkHealth()
  }, [])

  const saveSettings = async () => {
    if (isBusy || !hasChanges) return
    setOperation('save')
    try {
      const saved = await saveOrchestratorUiSettings(runtimeSettingsInput(settings))
      const next = { ...saved, orchestratorApiUrl: settings.orchestratorApiUrl }
      setForm({ settings: next, savedSettings: next })
      toast({ title: 'Settings saved', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setOperation(null)
    }
  }

  const restoreSettings = async () => {
    if (isBusy) return
    setOperation('restore')
    try {
      const saved = await resetOrchestratorUiSettings()
      const next = { ...saved, orchestratorApiUrl: settings.orchestratorApiUrl }
      setForm({ settings: next, savedSettings: next })
      setRestoreOpen(false)
      toast({ title: 'Runtime defaults restored', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not restore defaults',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'danger'
      })
    } finally {
      setOperation(null)
    }
  }

  if (healthState === 'checking') return <PlatformRuntimePageSkeleton />
  if (healthState === 'offline')
    return (
      <PlatformRuntimePageLayout showActions={false}>
        <StateView
          kind='unavailable'
          title='Orchestrator unavailable'
          description='Docker settings and platform management are offline until the orchestrator responds.'
          detail='Check the orchestrator service and Docker, then try again.'
          actions={[{ label: 'Try again', onClick: () => void checkHealth() }]}
        />
      </PlatformRuntimePageLayout>
    )

  return (
    <PlatformRuntimePageLayout
      isSaving={operation === 'save'}
      disabled={isBusy}
      hasChanges={hasChanges}
      onDiscard={() => setForm(current => ({ ...current, settings: current.savedSettings }))}
    >
      <form
        id='runtime-defaults-form'
        aria-label='Runtime defaults'
        onSubmit={event => {
          event.preventDefault()
          void saveSettings()
        }}
      >
        <PlatformRuntimeFieldsSection
          images={images}
          settings={settings}
          disabled={isBusy}
          onSettingsChange={patch => setForm(current => ({ ...current, settings: { ...current.settings, ...patch } }))}
        />
      </form>
      <PlatformRuntimeMaintenanceSection
        disabled={isBusy}
        onRestore={() => setRestoreOpen(true)}
      />
      <ConfirmMutationDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title='Restore runtime defaults?'
        description='Reset the default image, registry, inactivity timeout, APK upload limit, and optional service connection settings.'
        consequence='This replaces unsaved edits and saves immediately. The app data deletion policy and existing app definitions are unchanged.'
        confirmLabel='Restore defaults'
        tone='warning'
        pending={operation === 'restore'}
        pendingLabel='Restoring…'
        onConfirm={() => void restoreSettings()}
      />
    </PlatformRuntimePageLayout>
  )
}
