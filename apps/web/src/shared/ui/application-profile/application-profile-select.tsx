'use client'

import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { IconDatabase, IconDatabasePlus, IconLoader2, IconSparkles, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'
import type { SavedApplicationProfile } from '@/shared/model/application-profile/profile-history'

type ApplicationProfileSelectProps = {
  mode: ApplicationProfileMode
  name: string
  savedProfiles: SavedApplicationProfile[]
  onModeChange?: (mode: ApplicationProfileMode) => void
  onNameChange: (name: string) => void
  disabled?: boolean
  allowCustomName?: boolean
  selectedProfile?: { mode: ApplicationProfileMode; name: string }
  canDeleteProfiles?: boolean
  onDeleteProfile?: (name: string) => Promise<void> | void
}

const temporaryValue = 'temporary'
const newProfileValue = 'new'
const persistentPrefix = 'persistent:'

const persistentValueFor = (name: string) => `${persistentPrefix}${encodeURIComponent(name)}`
const profileNameFromValue = (value: string) => decodeURIComponent(value.slice(persistentPrefix.length))

const profileOptionItemClassName =
  'pr-2 [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1'

export const ApplicationProfileSelect = ({
  mode,
  name,
  savedProfiles,
  onModeChange,
  onNameChange,
  disabled,
  allowCustomName = true,
  selectedProfile,
  canDeleteProfiles,
  onDeleteProfile
}: ApplicationProfileSelectProps) => {
  const [editNewProfileName, setEditNewProfileName] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const persistentProfiles = useMemo(
    () => savedProfiles.filter(profile => profile.mode === 'persistent'),
    [savedProfiles]
  )
  const selectedName = name.trim()
  const selectedSavedProfile = persistentProfiles.some(profile => profile.name === selectedName)
  const value =
    mode === 'temporary'
      ? temporaryValue
      : editNewProfileName || !selectedSavedProfile
        ? newProfileValue
        : persistentValueFor(selectedName)

  const handleValueChange = (nextValue: string) => {
    if (nextValue === temporaryValue) {
      onModeChange?.('temporary')
      setEditNewProfileName(false)
      return
    }

    if (nextValue === newProfileValue) {
      onModeChange?.('persistent')
      onNameChange('')
      setEditNewProfileName(true)
      return
    }

    if (nextValue.startsWith(persistentPrefix)) {
      onModeChange?.('persistent')
      onNameChange(profileNameFromValue(nextValue))
      setEditNewProfileName(false)
    }
  }

  const requestDelete = (event: MouseEvent, profileName: string) => {
    event.preventDefault()
    event.stopPropagation()
    setProfileToDelete(profileName)
  }

  const confirmDelete = async () => {
    if (!profileToDelete || !onDeleteProfile) {
      return
    }

    setDeleting(true)
    try {
      await onDeleteProfile(profileToDelete)
      setProfileToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className='grid gap-4'>
      <div className='grid gap-2'>
        <Label>Profiles</Label>
        <Select
          value={value}
          disabled={disabled}
          onValueChange={handleValueChange}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align='start'>
            <SelectItem
              value={temporaryValue}
              label='Temporary'
              className={profileOptionItemClassName}
            >
              <span className='flex w-full min-w-0 items-center gap-3'>
                <span className='grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground'>
                  <IconSparkles className='size-4' />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>Temporary</span>
                  <span className='block truncate text-xs text-muted-foreground'>
                    No data will be saved after the session ends
                  </span>
                </span>
              </span>
            </SelectItem>
            {persistentProfiles.map(profile => {
              const isActive = selectedProfile?.mode === 'persistent' && selectedProfile.name === profile.name
              const isSelected = mode === 'persistent' && selectedName === profile.name
              const canDelete = Boolean(canDeleteProfiles && onDeleteProfile && !isActive)

              return (
                <SelectItem
                  key={profile.name}
                  value={persistentValueFor(profile.name)}
                  label={profile.name}
                  className={profileOptionItemClassName}
                >
                  <span className='flex w-full min-w-0 items-center gap-3'>
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground',
                        isSelected && 'bg-primary/18 text-primary'
                      )}
                    >
                      <IconDatabase className='size-4' />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate font-medium'>
                        {profile.name}
                        <Visible when={isActive}>
                          <span className='ml-1 font-normal text-primary'>(Running)</span>
                        </Visible>
                      </span>
                      <span className='block truncate text-xs text-muted-foreground'>
                        {isSelected ? 'Selected persistent profile' : 'Persistent data'}
                      </span>
                    </span>
                    <Visible when={canDelete}>
                      <button
                        type='button'
                        aria-label={`Remove ${profile.name}`}
                        className='ml-auto grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/12 hover:text-destructive'
                        onPointerDown={event => {
                          event.preventDefault()
                          event.stopPropagation()
                        }}
                        onClick={event => requestDelete(event, profile.name)}
                      >
                        <IconTrash className='size-4' />
                      </button>
                    </Visible>
                  </span>
                </SelectItem>
              )
            })}
            <Visible when={allowCustomName}>
              <SelectItem
                value={newProfileValue}
                label='New profile'
                className={profileOptionItemClassName}
              >
                <span className='flex w-full min-w-0 items-center gap-3'>
                  <span className='grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground'>
                    <IconDatabasePlus className='size-4' />
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-medium'>New profile</span>
                    <span className='block truncate text-xs text-muted-foreground'>
                      Create persistent data on first start
                    </span>
                  </span>
                </span>
              </SelectItem>
            </Visible>
          </SelectContent>
        </Select>
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

      <Dialog
        open={Boolean(profileToDelete)}
        onOpenChange={open => !open && setProfileToDelete(null)}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Remove profile</DialogTitle>
            <DialogDescription>
              Delete the saved profile and its persistent runtime data volume. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='secondary'
              disabled={deleting}
              onClick={() => setProfileToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              variant='destructive'
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              <Visible when={deleting}>
                <IconLoader2 className='size-4 animate-spin' />
              </Visible>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
