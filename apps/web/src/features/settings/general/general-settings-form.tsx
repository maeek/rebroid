'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconDeviceFloppy, IconRestore } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateCurrentAccentColorAction } from '@/server/users/actions/update-current-accent-color-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { resetGeneralUiSettings, saveGeneralUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { useAccentColorPreference } from '@/shared/model/theme/use-accent-color'
import { PageHeader } from '@/shared/ui/page/page-header'
import { StandardPage } from '@/shared/ui/page/page-layout'
import { AccentColorPicker } from '@/shared/ui/settings/accent-color-picker'
import { FormField } from '@/components/ui/form-field'
import { ViewerStreamingSliderFields } from '@/shared/ui/settings/viewer-streaming-slider-fields'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type { AccentColor } from '@/shared/model/theme/accent-color'

const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

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

const verticalSettingClassName = 'flex-col items-start w-full'

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
      toast({ title: 'Settings saved' })
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
      toast({ title: 'Settings reset' })
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
    <StandardPage className='gap-2'>
      <PageHeader
        breadcrumbs={[{ label: 'Preferences', href: '/preferences/general' }, { label: 'General' }]}
        title='General'
        actions={
          <>
            <Button
              variant='ghost'
              disabled={isSaving}
              onClick={() => void resetSettings()}
            >
              <IconRestore className='size-4' />
              Reset
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => void saveSettings()}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </Button>
          </>
        }
      />
      <section className='px-6 max-sm:px-4 w-full flex flex-col gap-10 pb-16'>
        <Section
          surface='plain'
          orientation='vertical'
          title='Appearance'
          titleClassName='pb-4'
          contentClassName='gap-6'
        >
          <AccentColorPicker
            value={accentColor}
            onChange={setAccentColor}
          />
        </Section>
        <Section
          surface='plain'
          orientation='vertical'
          title='Frontend defaults'
          titleClassName='pb-4'
          contentClassName='gap-6'
        >
          <FormField
            label='List refresh interval'
            description='Controls how often app lists refresh automatically across the frontend.'
            className='flex-col items-start w-full'
            layout='vertical'
          >
            <NumberSliderField
              value={String(settings.appListRefreshIntervalSeconds)}
              min={2}
              max={120}
              inputSuffix='seconds'
              suffix='s'
              rangeLabel='List refresh interval range'
              onValueChange={value =>
                updateSettings({
                  appListRefreshIntervalSeconds: numberValue(Number(value), settings.appListRefreshIntervalSeconds)
                })
              }
            />
          </FormField>
        </Section>
        <Section
          surface='plain'
          orientation='vertical'
          title='Streaming defaults'
          titleClassName='pb-4'
          contentClassName='gap-6'
        >
          <div className='grid gap-4 md:grid-cols-3'>
            <FormField
              label='Preset'
              description='Default quality profile for new viewer sessions.'
              className={verticalSettingClassName}
              layout='vertical'
            >
              <Select
                value={settings.defaultViewerPreset}
                onValueChange={value =>
                  updateSettings({
                    defaultViewerPreset:
                      value === 'low-latency' ||
                      value === 'balanced' ||
                      value === 'high-quality' ||
                      value === 'bandwidth-saver'
                        ? value
                        : 'balanced'
                  })
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='low-latency'>Low latency</SelectItem>
                  <SelectItem value='balanced'>Balanced</SelectItem>
                  <SelectItem value='high-quality'>High quality</SelectItem>
                  <SelectItem value='bandwidth-saver'>Bandwidth saver</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <ViewerStreamingSliderFields
              values={{
                bitrateMbps: settings.defaultViewerBitrateMbps,
                maxFps: settings.defaultViewerMaxFps,
                iFrameInterval: settings.defaultViewerIFrameInterval
              }}
              onChange={patch =>
                updateSettings({
                  defaultViewerBitrateMbps: patch.bitrateMbps ?? settings.defaultViewerBitrateMbps,
                  defaultViewerMaxFps: patch.maxFps ?? settings.defaultViewerMaxFps,
                  defaultViewerIFrameInterval: patch.iFrameInterval ?? settings.defaultViewerIFrameInterval
                })
              }
              SettingComponent={({ label, description, children }) => (
                <FormField
                  label={label}
                  description={description}
                  className={verticalSettingClassName}
                  layout='vertical'
                >
                  {children}
                </FormField>
              )}
            />
            <FormField
              label='Max size'
              description='Use 0 to fit the stream to the frame.'
              className={verticalSettingClassName}
              layout='vertical'
            >
              <Input
                value={settings.defaultViewerMaxSize}
                min={0}
                max={4096}
                type='number'
                onChange={event => updateSettings({ defaultViewerMaxSize: Number(event.target.value) })}
              />
            </FormField>
          </div>
          <FormField
            label='Enable keyboard in fullscreen'
            description='Fullscreen viewer sessions start with keyboard input captured.'
            className='w-full py-3'
          >
            <Switch
              checked={settings.defaultViewerKeyboardCaptureEnabled}
              onCheckedChange={checked => updateSettings({ defaultViewerKeyboardCaptureEnabled: checked })}
            />
          </FormField>
          <FormField
            label='Enable sound'
            description='Request audio when the viewer stream supports it.'
            className='w-full py-3'
          >
            <Switch
              checked={settings.defaultViewerSoundEnabled}
              onCheckedChange={checked => updateSettings({ defaultViewerSoundEnabled: checked })}
            />
          </FormField>
        </Section>
      </section>
    </StandardPage>
  )
}
