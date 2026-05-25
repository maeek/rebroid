import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import {
  loadSavedApplicationProfiles,
  rememberApplicationProfile
} from '@/features/applications/profiles/profile-history'
import { ApplicationProfilePicker } from '@/features/applications/profiles/profile-picker'
import { Setting } from '@/features/settings/components/setting'
import { toast } from '@/hooks/use-toast'
import { switchApplicationProfileAction } from '@/server/orchestrator/applications/mutation-actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

type AppManageProfileSettingsProps = {
  app: AppDefinition
  onUpdated: (app: AppDefinition) => void
}

const verticalSettingClassName = 'flex-col items-start w-full'

export const AppManageProfileSettings = ({ app, onUpdated }: AppManageProfileSettingsProps) => {
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(app.profileMode ?? 'persistent')
  const [profileName, setProfileName] = useState(app.profileName ?? 'default')
  const [savedProfiles, setSavedProfiles] = useState(() =>
    loadSavedApplicationProfiles(
      app.id,
      { mode: app.profileMode ?? 'persistent', name: app.profileName ?? 'default' },
      app.savedProfiles
    )
  )
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
      setSavedProfiles(
        loadSavedApplicationProfiles(
          app.id,
          {
            mode: app.profileMode ?? 'persistent',
            name: app.profileName ?? 'default'
          },
          app.savedProfiles
        )
      )
    }
  }, [app])

  const handleSwitchProfile = async () => {
    setIsSaving(true)
    try {
      const updated = await switchApplicationProfileAction(app.id, { profileMode, profileName })
      const mapped = mapAndroidApplicationToAppDefinition(updated)
      onUpdated(mapped)
      rememberApplicationProfile(app.id, {
        mode: mapped.profileMode ?? 'persistent',
        name: mapped.profileName ?? 'default'
      })
      setSavedProfiles(
        loadSavedApplicationProfiles(
          app.id,
          {
            mode: mapped.profileMode ?? 'persistent',
            name: mapped.profileName ?? 'default'
          },
          mapped.savedProfiles
        )
      )
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

  const handleProfileModeChange = (mode: ApplicationProfileMode) => {
    isDirtyRef.current = true
    setProfileMode(mode)
    setProfileName(current => {
      if (mode === 'temporary') {
        return 'temporary'
      }

      return current === 'temporary' ? 'default' : current
    })
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
        <ApplicationProfilePicker
          mode={profileMode}
          name={profileName}
          savedProfiles={savedProfiles}
          disabled={isSaving}
          onModeChange={handleProfileModeChange}
          onNameChange={value => {
            isDirtyRef.current = true
            setProfileName(value)
          }}
        />
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
