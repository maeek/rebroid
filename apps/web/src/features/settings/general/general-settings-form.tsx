'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateCurrentAccentColorAction } from '@/server/users/actions/update-current-accent-color-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { resetGeneralUiSettings, saveGeneralUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { useAccentColorPreference } from '@/shared/model/theme/use-accent-color'
import { GeneralSettingsFields } from './general-settings-fields'
import { GeneralSettingsLayout } from './general-settings-layout'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type { AccentColor } from '@/shared/model/theme/accent-color'

type SaveGeneralUiSettingsInput = Pick<
  OrchestratorUiSettings,
  | 'appListRefreshIntervalSeconds'
  | 'defaultViewerPreset'
  | 'defaultViewerBitrateMbps'
  | 'defaultViewerMaxFps'
  | 'defaultViewerMaxSize'
  | 'defaultViewerIFrameInterval'
  | 'defaultViewerKeyboardCaptureEnabled'
  | 'defaultViewerSoundEnabled'
>

const persistGeneralUiSettings = saveGeneralUiSettings
const restoreGeneralUiSettings = resetGeneralUiSettings

const toGeneralUiSettings = (settings: OrchestratorUiSettings): SaveGeneralUiSettingsInput => ({
  appListRefreshIntervalSeconds: settings.appListRefreshIntervalSeconds,
  defaultViewerPreset: settings.defaultViewerPreset,
  defaultViewerBitrateMbps: settings.defaultViewerBitrateMbps,
  defaultViewerMaxFps: settings.defaultViewerMaxFps,
  defaultViewerMaxSize: settings.defaultViewerMaxSize,
  defaultViewerIFrameInterval: settings.defaultViewerIFrameInterval,
  defaultViewerKeyboardCaptureEnabled: settings.defaultViewerKeyboardCaptureEnabled,
  defaultViewerSoundEnabled: settings.defaultViewerSoundEnabled
})

export const GeneralSettingsForm = ({
  initialAccentColor,
  initialSettings
}: {
  initialAccentColor: AccentColor
  initialSettings: OrchestratorUiSettings
}) => {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const saveAccentColor = useCallback(async (nextAccentColor: AccentColor) => {
    unwrapActionResult(await updateCurrentAccentColorAction(nextAccentColor))
  }, [])
  const { accentColor, setAccentColor } = useAccentColorPreference({
    initialAccentColor,
    saveAccentColor,
    onSaveError: error =>
      toast({
        title: 'Could not save accent color',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
  })

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  const updateSettings = (patch: Partial<OrchestratorUiSettings>) => {
    setSettings(current => ({ ...current, ...patch }))
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const generalSettings: SaveGeneralUiSettingsInput = toGeneralUiSettings(settings)
      const saved: OrchestratorUiSettings = await persistGeneralUiSettings(generalSettings)
      setSettings(saved)
      toast({ title: 'Settings saved', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const resetSettings = async () => {
    setIsSaving(true)
    try {
      const saved: OrchestratorUiSettings = await restoreGeneralUiSettings()
      setSettings(saved)
      toast({ title: 'Settings reset', variant: 'success' })
    } catch (error) {
      toast({
        title: 'Could not reset settings',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <GeneralSettingsLayout
      pending={isSaving}
      onReset={() => void resetSettings()}
      onSave={() => void saveSettings()}
    >
      <GeneralSettingsFields
        settings={settings}
        accentColor={accentColor}
        onSettingsChange={updateSettings}
        onAccentColorChange={setAccentColor}
      />
    </GeneralSettingsLayout>
  )
}
