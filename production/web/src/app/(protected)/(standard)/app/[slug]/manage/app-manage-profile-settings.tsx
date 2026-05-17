import { useEffect, useRef, useState } from 'react'
import { Setting } from '@/app/(protected)/_components/settings/setting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { mapAndroidApplicationToAppDefinition } from '@/lib/orchestrator/app-mapper'
import { switchApplicationProfileAction } from '@/server/orchestrator/applications/mutation-actions'
import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

type AppManageProfileSettingsProps = {
  app: AppDefinition
  onUpdated: (app: AppDefinition) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppManageProfileSettings = ({ app, onUpdated }: AppManageProfileSettingsProps) => {
  const [profileMode, setProfileMode] = useState<'persistent' | 'temporary'>(app.profileMode ?? 'persistent')
  const [profileName, setProfileName] = useState(app.profileName ?? 'default')
  const [isSaving, setIsSaving] = useState(false)
  const isDirtyRef = useRef(false)
  const previousAppIdRef = useRef(app.id)

  useEffect(() => {
    if (previousAppIdRef.current !== app.id) {
      previousAppIdRef.current = app.id
      isDirtyRef.current = false
    }

    if (!isDirtyRef.current) {
      setProfileMode(app.profileMode ?? 'persistent')
      setProfileName(app.profileName ?? 'default')
    }
  }, [app])

  const handleSwitchProfile = async () => {
    setIsSaving(true)
    try {
      const updated = await switchApplicationProfileAction(app.id, { profileMode, profileName })
      const mapped = mapAndroidApplicationToAppDefinition(updated)
      onUpdated(mapped)
      isDirtyRef.current = false
      setProfileMode(mapped.profileMode ?? 'persistent')
      setProfileName(mapped.profileName ?? 'default')
      toast({ title: 'Profile switched', description: 'Start the app to run with the selected profile.' })
    } catch (error) {
      toast({
        title: 'Could not switch profile',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Section
      title='Profile'
      boxed
      titleClassName='pb-4'
      contentClassName='gap-4'
    >
      <Setting
        label='Profile volume'
        description='Choose which data profile will be used next time this app starts.'
        className={verticalSettingClassName}
        variant='vertical'
      >
        <div className='grid w-full grid-cols-2 gap-3 max-sm:grid-cols-1'>
          <Select
            value={profileMode}
            onValueChange={value => {
              isDirtyRef.current = true
              setProfileMode(value === 'temporary' ? 'temporary' : 'persistent')
            }}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='persistent'>Persistent volume</SelectItem>
              <SelectItem value='temporary'>Temporary data</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={profileName}
            onChange={event => {
              isDirtyRef.current = true
              setProfileName(event.target.value)
            }}
          />
        </div>
      </Setting>
      <Button
        type='button'
        className='self-start'
        variant='secondary'
        disabled={isSaving}
        onClick={() => void handleSwitchProfile()}
      >
        Switch profile
      </Button>
    </Section>
  )
}
