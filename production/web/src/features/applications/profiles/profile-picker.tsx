'use client'

import { IconCheck, IconDatabase, IconSparkles } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
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
  emptyDescription?: string
}

export const ApplicationProfilePicker = ({
  mode,
  name,
  savedProfiles,
  onModeChange,
  onNameChange,
  disabled,
  allowCustomName = true,
  emptyDescription = 'Enter a profile name to create one when the app starts.'
}: ApplicationProfilePickerProps) => {
  const persistentProfiles = savedProfiles.filter(profile => profile.mode === 'persistent')
  const selectedName = name.trim() || 'default'

  return (
    <div className='grid gap-4'>
      <Visible when={!!onModeChange}>
        <div className='grid gap-2'>
          <Label>Profile storage</Label>
          <Select
            value={mode}
            disabled={disabled}
            onValueChange={value => onModeChange!(value === 'temporary' ? 'temporary' : 'persistent')}
          >
            <SelectTrigger className='w-full sm:w-56'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='persistent'>Persistent volume</SelectItem>
              <SelectItem value='temporary'>Temporary data</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Visible>

      {mode === 'persistent' ? (
        <>
          <div className='grid gap-2'>
            <Label>Saved profiles</Label>
            {persistentProfiles.length === 0 ? (
              <div className='rounded-lg border border-dashed border-border/80 bg-secondary/25 px-4 py-5 text-center'>
                <IconDatabase className='mx-auto size-6 text-muted-foreground' />
                <p className='mt-2 text-sm font-semibold'>No saved profiles yet</p>
                <p className='mt-1 text-xs text-muted-foreground'>{emptyDescription}</p>
              </div>
            ) : (
              <div className='grid gap-2'>
                {persistentProfiles.map(profile => {
                  const selected = profile.name === selectedName

                  return (
                    <button
                      key={profile.name}
                      type='button'
                      disabled={disabled}
                      className={cn(
                        'flex min-h-14 w-full items-center gap-3 rounded-lg border border-border/80 bg-secondary/35 px-3 text-left transition-[background-color,border-color,color] hover:border-primary/60 hover:bg-primary/8 disabled:cursor-not-allowed disabled:opacity-55',
                        selected && 'border-primary/75 bg-primary/14 text-foreground'
                      )}
                      onClick={() => onNameChange(profile.name)}
                    >
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground',
                          selected && 'bg-primary/18 text-primary'
                        )}
                      >
                        {selected ? <IconCheck className='size-4' /> : <IconDatabase className='size-4' />}
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='block truncate text-sm font-semibold'>{profile.name}</span>
                        <span className='block truncate text-xs text-muted-foreground'>Persistent data</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
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
        </>
      ) : (
        <div className='flex items-center gap-3 rounded-lg border border-border/80 bg-secondary/35 px-3 py-3'>
          <span className='grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground'>
            <IconSparkles className='size-4' />
          </span>
          <div className='min-w-0'>
            <p className='text-sm font-semibold'>Temporary data</p>
            <p className='text-xs text-muted-foreground'>Starts with a disposable profile for this run.</p>
          </div>
        </div>
      )}
    </div>
  )
}
