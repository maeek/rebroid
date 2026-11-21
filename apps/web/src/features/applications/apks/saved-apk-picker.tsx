'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { usePickerOptions } from '@/hooks/use-picker-options'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatBytes } from '@/lib/format-bytes'
import { getBff } from '@/lib/http/bff'
import type { ApkChoice } from '@/shared/contracts/apk-library'
import type { UploadedApk } from '@/shared/contracts/application'

const readSavedApks = (signal: AbortSignal) => getBff<ApkChoice[]>('/api/bff/apks', signal)

export const SavedApkPicker = ({
  disabled,
  onChoose
}: {
  disabled: boolean
  onChoose: (apk: UploadedApk) => void | Promise<void>
}) => {
  const [open, setOpen] = useState(false)
  const { items: choices, loading, error: loadError, retry } = usePickerOptions(open, readSavedApks)
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const cancelButton = useRef<HTMLButtonElement>(null)
  const choosing = useRef(false)
  const canChoose = !disabled && choices?.some(choice => choice.id === selected)

  const close = () => setOpen(false)

  const choose = async () => {
    if (!canChoose || choosing.current) return
    choosing.current = true
    setPending(true)
    setError(undefined)
    try {
      const apk = await getBff<UploadedApk>(`/api/bff/apks?id=${encodeURIComponent(selected)}`)
      await onChoose(apk)
      close()
    } catch (cause) {
      setError(getDisplayErrorMessage(cause, 'This APK is unavailable. Choose another file.'))
    } finally {
      choosing.current = false
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, event) => {
        if (pending) {
          event.cancel()
          return
        }
        if (next) {
          setOpen(true)
          setSelected('')
          setError(undefined)
        } else {
          close()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          disabled={disabled}
        >
          Saved APKs
        </Button>
      </DialogTrigger>
      <DialogContent
        initialFocus={cancelButton}
        className='grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-md'
      >
        <DialogHeader>
          <DialogTitle>Choose a saved APK</DialogTitle>
          <DialogDescription>Search by app name, filename, or package name.</DialogDescription>
        </DialogHeader>
        <div className='scrollbar-thin grid min-h-0 content-start gap-3 overflow-y-auto transform-gpu overscroll-contain p-1 -m-1'>
          {error ? <Notice tone='danger'>{error}</Notice> : null}
          {loadError ? (
            <Notice tone='danger'>{getDisplayErrorMessage(loadError, 'Could not load saved APKs.')}</Notice>
          ) : null}
          {loading && !choices?.length ? (
            <p
              role='status'
              className='text-sm text-foreground-muted'
            >
              Loading saved APKs…
            </p>
          ) : null}
          {!loading && choices?.length === 0 && !loadError ? (
            <p className='text-sm text-foreground-muted'>You have no saved APKs available.</p>
          ) : null}
          {choices?.length ? (
            <FormField
              label='Saved APK'
              layout='vertical'
            >
              <SingleSelectCombobox
                inline
                options={choices.map(apk => {
                  const label = apk.displayName ?? apk.originalName
                  return {
                    value: apk.id,
                    label,
                    description: [
                      apk.originalName !== label ? apk.originalName : null,
                      apk.packageName,
                      formatBytes(apk.sizeBytes)
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                })}
                value={selected}
                onValueChange={setSelected}
                disabled={pending}
                placeholder='Search your APKs'
              />
            </FormField>
          ) : null}
        </div>
        <DialogFooter>
          {loadError ? (
            <Button
              type='button'
              variant='ghost'
              onClick={retry}
              disabled={loading || pending}
            >
              Retry
            </Button>
          ) : null}
          <Button
            ref={cancelButton}
            type='button'
            variant='ghost'
            onClick={close}
            disabled={pending}
          >
            Cancel
          </Button>
          <MutationButton
            type='button'
            pending={pending}
            pendingLabel='Selecting…'
            disabled={!canChoose}
            onClick={() => void choose()}
          >
            Use APK
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
