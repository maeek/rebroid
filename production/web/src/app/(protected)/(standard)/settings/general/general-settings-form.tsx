'use client'

import { useEffect, useState } from 'react'
import { IconDeviceFloppy, IconRotateClockwise } from '@tabler/icons-react'
import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'
import { ProtectedStackPageLayout } from '@/app/(protected)/_components/protected-page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { resetGeneralUiSettings, saveGeneralUiSettings } from '@/lib/orchestrator/settings'
import { Setting } from '../../../_components/settings/setting'
import type { OrchestratorUiSettings } from '@/lib/orchestrator/ui-settings'

const numberValue = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

type SaveGeneralUiSettingsInput = Pick<OrchestratorUiSettings, 'appListRefreshIntervalSeconds' | 'removeDataOnDelete'>

const persistGeneralUiSettings = saveGeneralUiSettings
const restoreGeneralUiSettings = resetGeneralUiSettings

const toGeneralUiSettings = (settings: OrchestratorUiSettings): SaveGeneralUiSettingsInput => ({
  appListRefreshIntervalSeconds: settings.appListRefreshIntervalSeconds,
  removeDataOnDelete: settings.removeDataOnDelete
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
      toast({ title: 'Could not save settings', description: error instanceof Error ? error.message : 'Unknown error' })
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
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <section className='py-4 px-6 max-sm:px-4 flex items-center justify-between gap-3 shrink-0 bg-background'>
        <div className='flex flex-col gap-2'>
          <PageBreadcrumbs
            className='pt-0'
            items={[{ label: 'Settings', href: '/settings/general' }, { label: 'General' }]}
          />
          <h2 className='text-3xl max-sm:text-xl font-medium shrink-0 pt-4'>General</h2>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='secondary'
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
          contentClassName='gap-6'
        >
          <Setting
            label='List refresh interval'
            description='Controls how often app lists refresh automatically across the frontend.'
            className='flex-col items-start w-full'
            variant='vertical'
          >
            <div className='flex items-center gap-2 w-full'>
              <Input
                value={settings.appListRefreshIntervalSeconds}
                min={2}
                max={120}
                type='number'
                onChange={event =>
                  updateSettings({
                    appListRefreshIntervalSeconds: numberValue(
                      Number(event.target.value),
                      settings.appListRefreshIntervalSeconds
                    )
                  })
                }
              />
              <span className='text-secondary-foreground text-sm pl-2'>seconds</span>
            </div>
          </Setting>
          <Setting
            label='Remove data on delete'
            description='When enabled, deleting an app also removes its persistent storage volume and stored APK data.'
            className='w-full rounded-md bg-background/45 px-4 py-3'
          >
            <Switch
              checked={settings.removeDataOnDelete}
              onCheckedChange={checked => updateSettings({ removeDataOnDelete: checked })}
            />
          </Setting>
        </Section>
      </section>
    </ProtectedStackPageLayout>
  )
}
