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
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatBytes } from '@/lib/format-bytes'
import { getBff } from '@/lib/http/bff'
import type { ApkChoice } from '@/shared/contracts/apk-library'
import type { UploadedApk } from '@/shared/contracts/application'

export const SavedApkPicker = ({
  disabled,
  onChoose
}: {
  disabled: boolean
  onChoose: (apk: UploadedApk) => void | Promise<void>
}) => {
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState<ApkChoice[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const cancelButton = useRef<HTMLButtonElement>(null)
  const request = useRef<AbortController | null>(null)

  const load = async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(undefined)
    try {
      const uploads = await getBff<ApkChoice[]>('/api/bff/apks', controller.signal)
      if (!controller.signal.aborted) setChoices(uploads)
    } catch (cause) {
      if (!controller.signal.aborted) setError(getDisplayErrorMessage(cause, 'Could not load saved APKs.'))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const close = () => {
    request.current?.abort()
    setOpen(false)
  }

  const choose = async () => {
    if (!selected || pending) return
    setPending(true)
    setError(undefined)
    try {
      const apk = await getBff<UploadedApk>(`/api/bff/apks?id=${encodeURIComponent(selected)}`)
      await onChoose(apk)
      close()
    } catch (cause) {
      setError(getDisplayErrorMessage(cause, 'This APK is unavailable. Choose another file.'))
    } finally {
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
          setChoices([])
          void load()
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
        <div className='scrollbar-thin grid min-h-0 content-start gap-3 overflow-y-auto overscroll-contain p-1 -m-1'>
          {error ? <Notice tone='danger'>{error}</Notice> : null}
          {loading ? (
            <p
              role='status'
              className='text-sm text-foreground-muted'
            >
              Loading saved APKs…
            </p>
          ) : null}
          {!loading && !choices.length && !error ? (
            <p className='text-sm text-foreground-muted'>You have no saved APKs available.</p>
          ) : null}
          {choices.length ? (
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
                disabled={pending || loading}
                placeholder='Search your APKs'
              />
            </FormField>
          ) : null}
        </div>
        <DialogFooter>
          {error && !choices.length ? (
            <Button
              type='button'
              variant='ghost'
              onClick={() => void load()}
              disabled={loading}
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
            disabled={!selected || disabled}
            onClick={() => void choose()}
          >
            Use APK
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
