'use client'

import { useEffect, useState } from 'react'
import { IconDeviceFloppy, IconRotateClockwise } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ViewerStreamingSliderFields } from '@/features/applications/viewer/settings/viewer-streaming-slider-fields'
import { Setting } from '@/features/settings/components/setting'
import { resetGeneralUiSettings, saveGeneralUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
import { toast } from '@/hooks/use-toast'
import type { OrchestratorUiSettings } from '@/features/settings/domain/orchestrator-ui-settings'

const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

type SaveGeneralUiSettingsInput = Pick<
  OrchestratorUiSettings,
  | 'appListRefreshIntervalSeconds'
  | 'removeDataOnDelete'
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
  removeDataOnDelete: settings.removeDataOnDelete,
  defaultViewerPreset: settings.defaultViewerPreset,
  defaultViewerBitrateMbps: settings.defaultViewerBitrateMbps,
  defaultViewerMaxFps: settings.defaultViewerMaxFps,
  defaultViewerMaxSize: settings.defaultViewerMaxSize,
  defaultViewerIFrameInterval: settings.defaultViewerIFrameInterval,
  defaultViewerKeyboardCaptureEnabled: settings.defaultViewerKeyboardCaptureEnabled,
  defaultViewerSoundEnabled: settings.defaultViewerSoundEnabled
})

export const GeneralSettingsForm = ({ initialSettings }: { initialSettings: OrchestratorUiSettings }) => {
  const [settings, setSettings] = useState(initialSettings)
  const [isSaving, setIsSaving] = useState(false)

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
      const saved: OrchestratorUiSettings = await restoreGeneralUiSettings()
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

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='py-4 px-6 max-sm:px-4 flex items-center justify-between gap-3 shrink-0'>
        <div className='flex flex-col gap-2'>
          <PageBreadcrumbs
            className='pt-0'
            items={[{ label: 'Settings', href: '/settings/general' }, { label: 'General' }]}
          />
          <h2 className='text-3xl max-sm:text-xl font-medium shrink-0 pt-4'>General</h2>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='ghost'
            disabled={isSaving}
            onClick={() => void resetSettings()}
          >
            <IconRotateClockwise className='size-4' />
            Reset
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => void saveSettings()}
          >
            <IconDeviceFloppy className='size-4' />
            Save
          </Button>
        </div>
      </section>
      <section className='px-6 max-sm:px-4 w-full flex flex-col gap-6 pb-16'>
        <Section
          orientation='vertical'
          title='Frontend defaults'
          boxed
          titleClassName='pb-4'
          contentClassName='gap-6'
        >
          <Setting
            label='List refresh interval'
            description='Controls how often app lists refresh automatically across the frontend.'
            className='flex-col items-start w-full'
            variant='vertical'
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
          </Setting>
          <Setting
            label='Remove data on delete'
            description='When enabled, deleting an app also removes its persistent storage volume and stored APK data.'
            className='w-full py-3'
          >
            <Switch
              checked={settings.removeDataOnDelete}
              onCheckedChange={checked => updateSettings({ removeDataOnDelete: checked })}
            />
          </Setting>
        </Section>
        <Section
          orientation='vertical'
          title='Streaming defaults'
          boxed
          titleClassName='pb-4'
          contentClassName='gap-6'
        >
          <div className='grid gap-4 md:grid-cols-3'>
            <Setting
              label='Preset'
              description='Default quality profile for new viewer sessions.'
              className={verticalSettingClassName}
              variant='vertical'
            >
              <Select
                value={settings.defaultViewerPreset}
                onValueChange={value =>
                  updateSettings({
                    defaultViewerPreset:
                      value === 'bandwidth' || value === 'quality' || value === 'balanced' ? value : 'balanced'
                  })
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='bandwidth'>Bandwidth</SelectItem>
                  <SelectItem value='balanced'>Balanced</SelectItem>
                  <SelectItem value='quality'>Quality</SelectItem>
                </SelectContent>
              </Select>
            </Setting>
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
                <Setting
                  label={label}
                  description={description}
                  className={verticalSettingClassName}
                  variant='vertical'
                >
                  {children}
                </Setting>
              )}
            />
            <Setting
              label='Max size'
              description='Use 0 to fit the stream to the frame.'
              className={verticalSettingClassName}
              variant='vertical'
            >
              <Input
                value={settings.defaultViewerMaxSize}
                min={0}
                max={4096}
                type='number'
                onChange={event => updateSettings({ defaultViewerMaxSize: Number(event.target.value) })}
              />
            </Setting>
          </div>
          <Setting
            label='Enable keyboard in fullscreen'
            description='Fullscreen viewer sessions start with keyboard input captured.'
            className='w-full py-3'
          >
            <Switch
              checked={settings.defaultViewerKeyboardCaptureEnabled}
              onCheckedChange={checked => updateSettings({ defaultViewerKeyboardCaptureEnabled: checked })}
            />
          </Setting>
          <Setting
            label='Enable sound'
            description='Request audio when the viewer stream supports it.'
            className='w-full py-3'
          >
            <Switch
              checked={settings.defaultViewerSoundEnabled}
              onCheckedChange={checked => updateSettings({ defaultViewerSoundEnabled: checked })}
            />
          </Setting>
        </Section>
      </section>
    </ProtectedStackPageLayout>
  )
}
