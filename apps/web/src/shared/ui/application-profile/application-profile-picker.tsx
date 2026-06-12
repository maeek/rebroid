'use client'

import { useState } from 'react'
import { IconDatabase, IconDatabasePlus, IconSparkles } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Visible } from '@/components/ui/visible'
import { ProfileTile } from './profile-tile'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type { SavedApplicationProfile } from '@/shared/model/application-profile/profile-history'

type ApplicationProfilePickerProps = {
  mode: ApplicationProfileMode
  name: string
  savedProfiles: SavedApplicationProfile[]
  onModeChange?: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  disabled?: boolean
  allowCustomName?: boolean
  selectedProfile?: { mode: ApplicationProfileMode; name: string }
}

export const ApplicationProfilePicker = ({
  mode,
  name,
  savedProfiles,
  onModeChange,
  onNameChange,
  disabled,
  allowCustomName = true,
  selectedProfile
}: ApplicationProfilePickerProps) => {
  const [editNewProfileName, setEditNewProfileName] = useState(false)
  const persistentProfiles = savedProfiles.filter(profile => profile.mode === 'persistent')
  const selectedName = name.trim()

  return (
    <div className='grid gap-4'>
      <Label>Profiles</Label>
      <div className='grid grid-cols-2 gap-2'>
        <ProfileTile
          name='Temporary'
          selected={mode === 'temporary'}
          isActive={selectedProfile?.mode === 'temporary'}
          disabled={disabled}
          icon={<IconSparkles className='size-4' />}
          onChange={() => {
            onModeChange?.('temporary')
            setEditNewProfileName(false)
          }}
          className='min-w-0'
          description='No data will be saved after the session ends'
        />
        {persistentProfiles.map(profile => {
          const selected = profile.name === selectedName

          return (
            <ProfileTile
              key={profile.name}
              name={profile.name}
              selected={selected}
              isActive={selectedProfile?.mode === 'persistent' && selectedProfile.name === profile.name}
              disabled={disabled}
              icon={<IconDatabase className='size-4' />}
              className='min-w-0'
              onChange={() => {
                onModeChange?.('persistent')
                onNameChange(profile.name)
                setEditNewProfileName(false)
              }}
              description={selected ? 'Currently active profile' : 'Persistent data'}
            />
          )
        })}
        <Visible when={allowCustomName && !editNewProfileName}>
          <ProfileTile
            name='New profile'
            disabled={disabled}
            icon={<IconDatabasePlus className='size-4' />}
            className='min-w-0'
            description='No data will be saved after the session ends'
            onChange={() => {
              setEditNewProfileName(true)
              onNameChange('')
            }}
          />
        </Visible>
      </div>

      <Visible when={allowCustomName && editNewProfileName}>
        <div className='grid gap-2'>
          <Label>New profile</Label>
          <Input
            value={name}
            disabled={disabled}
            autoFocus
            placeholder='default'
            onChange={event => onNameChange(event.target.value)}
          />
        </div>
      </Visible>
    </div>
  )
}
