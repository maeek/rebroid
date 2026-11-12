'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { PlatformRuntimeFieldsSection } from '@/features/settings/orchestrator/platform-runtime-fields-section'
import { PlatformRuntimeMaintenanceSection } from '@/features/settings/orchestrator/platform-runtime-maintenance-section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { androidRenderingSettingsSchema } from '@/shared/contracts/android-rendering-settings'
import {
  resetOrchestratorUiSettings,
  saveOrchestratorUiSettings
} from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformRuntimePageLayout } from './platform-runtime-page-layout'
import type { PlatformImage } from '@/shared/contracts/platform'
import type { OrchestratorUiSettings, RuntimeUiSettingsPatch } from '@/shared/model/settings/orchestrator-ui-settings'
import type { AndroidRenderingSettings as RenderingSettings } from '@rebroid/android-application-core/redroid-runtime'

const runtimeFields = [
  'defaultContainerImage',
  'dockerImageRegistry',
  'defaultInactivityTimeoutSeconds',
  'maxApkUploadSizeMb',
  'removeDataOnDelete',
  'androidRendering'
] as const satisfies ReadonlyArray<keyof Omit<RuntimeUiSettingsPatch, 'services'>>

const getRuntimeSettingsPatch = (settings: OrchestratorUiSettings, savedSettings: OrchestratorUiSettings) => {
  const patch: Pick<RuntimeUiSettingsPatch, (typeof runtimeFields)[number]> = {}
  const includeChangedField = <Key extends (typeof runtimeFields)[number]>(key: Key) => {
    if (JSON.stringify(settings[key]) !== JSON.stringify(savedSettings[key])) patch[key] = settings[key]
  }
  runtimeFields.forEach(includeChangedField)
  return patch
}

export const PlatformRuntimeForm = ({
  images,
  initialSettings,
  appliedRenderingSettings,
  unavailable = false
}: {
  images: PlatformImage[]
  initialSettings: OrchestratorUiSettings
  appliedRenderingSettings: (RenderingSettings | null)[] | null
  unavailable?: boolean
}) => {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [form, setForm] = useState({ settings: initialSettings, savedSettings: initialSettings })
  const { settings, savedSettings } = form
  const [operation, setOperation] = useState<'save' | 'restore' | null>(null)
  const [renderingSaveOpen, setRenderingSaveOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const initialSnapshot = useRef(JSON.stringify(initialSettings))
  const patch = getRuntimeSettingsPatch(settings, savedSettings)
  const hasChanges = Object.keys(patch).length > 0
  const renderingValid = androidRenderingSettingsSchema.safeParse(settings.androidRendering).success
  const isBusy = operation !== null || unavailable

  useEffect(() => {
    const snapshot = JSON.stringify(initialSettings)
    if (initialSnapshot.current === snapshot) return
    initialSnapshot.current = snapshot
    setForm(current => ({
      settings: { ...initialSettings, ...getRuntimeSettingsPatch(current.settings, current.savedSettings) },
      savedSettings: initialSettings
    }))
  }, [initialSettings])

  const saveSettings = async () => {
    if (isBusy || !hasChanges || !renderingValid) return
    setOperation('save')
    try {
      const saved = await saveOrchestratorUiSettings(patch)
      setForm({ settings: saved, savedSettings: saved })
      setRenderingSaveOpen(false)
      toast({ title: 'Settings saved', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: getDisplayErrorMessage(error),
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
      setForm({ settings: saved, savedSettings: saved })
      setRestoreOpen(false)
      toast({ title: 'Runtime defaults restored', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not restore defaults',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setOperation(null)
    }
  }

  return (
    <PlatformRuntimePageLayout
      isSaving={operation === 'save'}
      disabled={isBusy}
      hasChanges={hasChanges}
      saveDisabled={!renderingValid}
      onDiscard={() => setForm(current => ({ ...current, settings: current.savedSettings }))}
    >
      {unavailable ? (
        <Notice
          tone='warning'
          title='Runtime defaults could not be refreshed'
          description='Your draft is kept. Settings and maintenance will be available when the runtime service responds.'
          actions={
            <MutationButton
              variant='ghost'
              pending={refreshing}
              pendingLabel='Retrying…'
              onClick={() => startRefresh(() => router.refresh())}
            >
              Try again
            </MutationButton>
          }
        />
      ) : null}
      <PlatformRuntimeFieldsSection
        images={images}
        settings={settings}
        savedRenderingSettings={savedSettings.androidRendering}
        appliedRenderingSettings={appliedRenderingSettings}
        disabled={isBusy}
        onSettingsChange={changes =>
          setForm(current => ({ ...current, settings: { ...current.settings, ...changes } }))
        }
        onSubmit={event => {
          event.preventDefault()
          if (isBusy || !hasChanges || !renderingValid) return
          if (patch.androidRendering) {
            setRenderingSaveOpen(true)
          } else {
            void saveSettings()
          }
        }}
      />
      <PlatformRuntimeMaintenanceSection
        disabled={isBusy}
        onRestore={() => setRestoreOpen(true)}
      />
      <ConfirmMutationDialog
        open={renderingSaveOpen}
        onOpenChange={setRenderingSaveOpen}
        title='Save Android rendering changes?'
        description='Stop and start affected Redroid apps to apply the new rendering setting. Persistent profiles are kept, but replacing a container can clear temporary data.'
        consequence='If an app still cannot connect to ADB after starting, use Restart sidecar in Platform settings → Services → Display sessions, then retry the app. Restarting the sidecar interrupts active display sessions.'
        confirmLabel='Save changes'
        confirmDisabled={isBusy || !patch.androidRendering || !renderingValid}
        tone='warning'
        pending={operation === 'save'}
        pendingLabel='Saving…'
        onConfirm={() => void saveSettings()}
      />
      <ConfirmMutationDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title='Restore runtime defaults?'
        description='Reset the default image, registry, inactivity timeout, APK upload limit, and optional service connection settings.'
        consequence='This replaces unsaved edits and saves immediately. The app data deletion policy and existing app definitions are unchanged.'
        confirmLabel='Restore defaults'
        confirmDisabled={unavailable}
        tone='warning'
        pending={operation === 'restore'}
        pendingLabel='Restoring…'
        onConfirm={() => void restoreSettings()}
      />
    </PlatformRuntimePageLayout>
  )
}
