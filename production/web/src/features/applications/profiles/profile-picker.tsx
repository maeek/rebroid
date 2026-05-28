'use client'

import { IconDatabase, IconSparkles } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProfileTile } from './profile-tile'
import type { SavedApplicationProfile } from './profile-history'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

type ApplicationProfilePickerProps = {
  mode: ApplicationProfileMode
  name: string
  savedProfiles: SavedApplicationProfile[]
  onModeChange?: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  disabled?: boolean
  allowCustomName?: boolean
}

export const ApplicationProfilePicker = ({
  mode,
  name,
  savedProfiles,
  onModeChange,
  onNameChange,
  disabled,
  allowCustomName = true
}: ApplicationProfilePickerProps) => {
  const persistentProfiles = savedProfiles.filter(profile => profile.mode === 'persistent')
  const selectedName = name.trim() || 'default'

  return (
    <div className='grid gap-4'>
      <Label>Profiles</Label>
      <div className='flex gap-2 flex-wrap'>
        <ProfileTile
          name='Temporary'
          selected={mode === 'temporary'}
          disabled={disabled}
          icon={<IconSparkles className='size-4' />}
          onChange={() => onModeChange?.('temporary')}
          className='min-w-0 flex-1/3 shrink'
          description='No data will be saved after the session ends'
        />
        {persistentProfiles.map(profile => {
          const selected = profile.name === selectedName

          return (
            <ProfileTile
              key={profile.name}
              name={profile.name}
              selected={selected}
              disabled={disabled}
              icon={<IconDatabase className='size-4' />}
              className='min-w-0 flex-1/3 shrink'
              onChange={() => {
                onModeChange?.('persistent')
                onNameChange(profile.name)
              }}
              description={selected ? 'Currently active profile' : 'Persistent data'}
            />
          )
        })}
      </div>

      {allowCustomName ? (
        <div className='grid gap-2'>
          <Label>Profile name</Label>
          <Input
            value={name}
            disabled={disabled}
            placeholder='default'
            onChange={event => onNameChange(event.target.value)}
          />
        </div>
      ) : null}
    </div>
  )
}
