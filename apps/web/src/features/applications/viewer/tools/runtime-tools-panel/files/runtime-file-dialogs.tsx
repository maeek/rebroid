'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { runtimeFileNameError } from './downloads-tools-section-model'
import type { ApplicationRuntimeFile } from '@/shared/contracts/application'

const RuntimeFileNameDialog = ({
  description,
  initialName,
  label,
  onOpenChange,
  onSubmit,
  open,
  submitLabel,
  title
}: {
  description: string
  initialName: string
  label: string
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<boolean>
  open: boolean
  submitLabel: string
  title: string
}) => {
  const [name, setName] = useState(initialName)
  const [pending, setPending] = useState(false)
  const nameError = runtimeFileNameError(name)

  useEffect(() => {
    if (open) setName(initialName)
  }, [initialName, open])

  const submit = async () => {
    const normalized = name.trim()
    if (nameError) return
    setPending(true)
    const succeeded = await onSubmit(normalized)
    setPending(false)
    if (succeeded) onOpenChange(false)
  }

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={nextOpen => {
        if (!pending) onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className='sm:max-w-md'
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FormField
          layout='vertical'
          label={label}
          required
          error={nameError}
        >
          <Input
            value={name}
            maxLength={255}
            disabled={pending}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submit()
              }
            }}
          />
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type='button'
              variant='secondary'
              className='max-sm:min-h-11'
              disabled={pending}
            >
              Cancel
            </Button>
          </DialogClose>
          <MutationButton
            type='button'
            className='max-sm:min-h-11'
            pending={pending}
            pendingLabel='Saving…'
            disabled={Boolean(nameError)}
            onClick={() => void submit()}
          >
            {submitLabel}
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const RuntimeFileDialogs = ({
  createOpen,
  deleteEntry,
  onCreate,
  onCreateOpenChange,
  onDelete,
  onDeleteEntryChange,
  onRename,
  onRenameEntryChange,
  renameEntry
}: {
  createOpen: boolean
  deleteEntry: ApplicationRuntimeFile | null
  onCreate: (name: string) => Promise<boolean>
  onCreateOpenChange: (open: boolean) => void
  onDelete: (entry: ApplicationRuntimeFile) => Promise<boolean>
  onDeleteEntryChange: (entry: ApplicationRuntimeFile | null) => void
  onRename: (entry: ApplicationRuntimeFile, name: string) => Promise<boolean>
  onRenameEntryChange: (entry: ApplicationRuntimeFile | null) => void
  renameEntry: ApplicationRuntimeFile | null
}) => {
  const [deletePending, setDeletePending] = useState(false)

  return (
    <>
      <RuntimeFileNameDialog
        open={createOpen}
        title='Create folder'
        description='Create a folder in the current runtime directory.'
        label='Folder name'
        initialName=''
        submitLabel='Create folder'
        onOpenChange={onCreateOpenChange}
        onSubmit={onCreate}
      />
      <RuntimeFileNameDialog
        open={renameEntry !== null}
        title='Rename item'
        description='Rename this item without moving it to another directory.'
        label='New name'
        initialName={renameEntry?.name ?? ''}
        submitLabel='Rename'
        onOpenChange={open => {
          if (!open) onRenameEntryChange(null)
        }}
        onSubmit={name => (renameEntry ? onRename(renameEntry, name) : Promise.resolve(false))}
      />
      <ConfirmMutationDialog
        open={deleteEntry !== null}
        title={`Delete ${deleteEntry?.type === 'directory' ? 'folder' : 'file'}?`}
        description='This action cannot be undone.'
        summary={deleteEntry?.path}
        consequence={
          deleteEntry?.type === 'directory'
            ? 'The folder and everything inside it will be permanently deleted.'
            : 'The file will be permanently deleted.'
        }
        confirmLabel='Delete permanently'
        pendingLabel='Deleting…'
        pending={deletePending}
        onOpenChange={open => {
          if (!open) onDeleteEntryChange(null)
        }}
        onConfirm={() => {
          if (!deleteEntry) return
          setDeletePending(true)
          void onDelete(deleteEntry).then(succeeded => {
            setDeletePending(false)
            if (succeeded) onDeleteEntryChange(null)
          })
        }}
      />
    </>
  )
}
