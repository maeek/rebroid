'use client'

import { useId, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { IconDatabase, IconDatabasePlus, IconSparkles, IconTrash } from '@tabler/icons-react'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { cn } from '@/lib/utils'
import type { ApplicationProfileMode } from '@/shared/contracts/application'
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
  const nameId = useId()
  const [editNewProfileName, setEditNewProfileName] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const selectedName = name.trim()
  const persistentProfiles = useMemo(() => {
    const saved = savedProfiles.filter(profile => profile.mode === 'persistent')
    if (
      mode !== 'persistent' ||
      !selectedName ||
      editNewProfileName ||
      saved.some(profile => profile.name === selectedName)
    )
      return saved
    return [...saved, { mode: 'persistent' as const, name: selectedName }]
  }, [editNewProfileName, mode, savedProfiles, selectedName])
  const selectedSavedProfile = persistentProfiles.some(profile => profile.name === selectedName)
  let value = persistentValueFor(selectedName)
  if (mode === 'temporary') value = temporaryValue
  else if (editNewProfileName || !selectedSavedProfile) value = newProfileValue

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
    setDeleteError(null)
    setProfileToDelete(profileName)
  }

  const confirmDelete = async () => {
    if (!profileToDelete || !onDeleteProfile || deleting) {
      return
    }

    setDeleting(true)
    setDeleteError(null)
    try {
      await onDeleteProfile(profileToDelete)
      setProfileToDelete(null)
    } catch (error) {
      setDeleteError(getDisplayErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className='grid gap-4'>
      <FormField
        label='Profile'
        layout='vertical'
      >
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
                <span className='grid size-7 shrink-0 place-items-center rounded-control bg-surface-band text-foreground-muted'>
                  <IconSparkles className='size-4' />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>Temporary</span>
                  <span className='block truncate text-xs text-foreground-muted'>
                    No data will be saved after the session ends
                  </span>
                </span>
              </span>
            </SelectItem>
            {persistentProfiles.map(profile => {
              const isActive = selectedProfile?.mode === 'persistent' && selectedProfile.name === profile.name
              const isSelected = mode === 'persistent' && selectedName === profile.name
              const saved = savedProfiles.some(item => item.mode === 'persistent' && item.name === profile.name)
              const canDelete = Boolean(canDeleteProfiles && onDeleteProfile && saved && !isActive)

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
                        'grid size-7 shrink-0 place-items-center rounded-control bg-surface-band text-foreground-muted',
                        isSelected && 'bg-primary/18 text-primary'
                      )}
                    >
                      <IconDatabase className='size-4' />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate font-medium'>
                        {profile.name}
                        <Visible when={isActive}>
                          <span className='ml-1 font-normal text-primary'>(Active)</span>
                        </Visible>
                      </span>
                      <span className='block truncate text-xs text-foreground-muted'>
                        {isSelected ? 'Selected persistent profile' : 'Persistent data'}
                      </span>
                    </span>
                    <Visible when={canDelete}>
                      <button
                        type='button'
                        aria-label={`Remove ${profile.name}`}
                        className='ml-auto grid size-7 shrink-0 place-items-center rounded-control text-foreground-muted transition hover:bg-danger/12 hover:text-danger'
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
                  <span className='grid size-7 shrink-0 place-items-center rounded-control bg-surface-band text-foreground-muted'>
                    <IconDatabasePlus className='size-4' />
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-medium'>New profile</span>
                    <span className='block truncate text-xs text-foreground-muted'>
                      Create persistent data on first start
                    </span>
                  </span>
                </span>
              </SelectItem>
            </Visible>
          </SelectContent>
        </Select>
      </FormField>

      <Visible when={allowCustomName && editNewProfileName}>
        <FormField
          label='New profile name'
          controlId={nameId}
          layout='vertical'
        >
          <Input
            value={name}
            disabled={disabled}
            placeholder='default'
            onChange={event => onNameChange(event.target.value)}
          />
        </FormField>
      </Visible>

      <ConfirmMutationDialog
        open={Boolean(profileToDelete)}
        onOpenChange={open => !open && setProfileToDelete(null)}
        title='Remove profile?'
        description='Delete the saved profile and its persistent data. This cannot be undone.'
        summary={profileToDelete}
        consequence={deleteError}
        confirmLabel='Remove profile'
        pendingLabel='Removing…'
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
