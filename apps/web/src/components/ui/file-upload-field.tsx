'use client'

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to reveal truncated filenames. */

import { useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { OperationProgress } from '@/components/ui/operation-progress'
import { Surface } from '@/components/ui/surface'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type FileUploadFieldProps = ComponentProps<'input'> & {
  pendingLabel?: string
  pending?: boolean
  progress?: number | null
  filenameLabel?: string | null
  buttonLabel?: string
  emptyLabel?: string
  preview?: ReactNode
  previewActions?: ReactNode
}

export const FileUploadField = ({
  id,
  className,
  onChange,
  disabled,
  pending,
  progress,
  pendingLabel = 'Uploading…',
  filenameLabel,
  buttonLabel = 'Choose file',
  emptyLabel = 'No file selected',
  preview,
  previewActions,
  ...props
}: FileUploadFieldProps) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const input = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')
  const displayFilename = filenameLabel ?? (filename || emptyLabel)
  let accessibleLabel = !preview && props['aria-label'] ? `Choose ${props['aria-label']}` : undefined
  if (pending && !preview) accessibleLabel = pendingLabel
  const statusText = pending ? [pendingLabel, displayFilename].filter(Boolean).join(' ') : displayFilename
  const status = (
    <div className={cn('min-w-0 flex-1', preview && !previewActions && 'max-[379px]:self-end')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot='file-name'
            role='status'
            className={cn(
              'block truncate text-xs text-foreground-muted focus-visible:outline-2 focus-visible:outline-ring',
              preview && 'text-foreground touch:text-sm/5'
            )}
            tabIndex={0}
          >
            {statusText}
          </span>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm break-all'>{statusText}</TooltipContent>
      </Tooltip>
      {pending && progress !== undefined ? (
        <div className='mt-1 flex items-center gap-2'>
          <OperationProgress
            value={progress}
            label='File upload progress'
            className='h-1 bg-control-border/45'
          />
          <span
            aria-hidden='true'
            className='w-[4ch] shrink-0 text-right text-xs/4 text-foreground-muted tabular-nums'
          >
            {progress === null ? null : `${progress}%`}
          </span>
        </div>
      ) : null}
    </div>
  )
  const picker = (
    <MutationButton
      type='button'
      variant={preview ? 'ghost' : 'outline'}
      className={preview ? 'max-[379px]:w-fit' : undefined}
      pending={pending}
      pendingLabel={buttonLabel}
      disabled={disabled}
      aria-controls={inputId}
      aria-label={accessibleLabel}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      onClick={() => input.current?.click()}
    >
      <IconUpload
        aria-hidden
        className='size-4'
      />
      {buttonLabel}
    </MutationButton>
  )
  return (
    <div
      data-slot='file-upload-field'
      className={cn(
        'w-full min-w-0',
        !preview && 'flex items-center gap-3',
        previewActions && '@container/upload',
        className
      )}
      aria-busy={preview ? undefined : pending}
    >
      <input
        {...props}
        id={inputId}
        ref={input}
        type='file'
        hidden
        tabIndex={-1}
        disabled={disabled || pending}
        onChange={event => {
          setFilename(event.target.files?.[0]?.name ?? '')
          onChange?.(event)
        }}
      />
      {preview ? (
        <Surface
          level='control'
          className={cn(
            'grid min-h-20 min-w-0 items-center gap-2 p-2 sm:gap-3 sm:px-3',
            previewActions
              ? 'grid-cols-[auto_minmax(0,1fr)] @min-[24rem]/upload:grid-cols-[auto_minmax(0,1fr)_auto]'
              : 'grid-cols-[auto_minmax(0,1fr)_auto] max-[379px]:grid-cols-[auto_minmax(0,1fr)] max-[379px]:gap-y-0'
          )}
        >
          <div
            data-slot='file-upload-preview'
            className={cn(!previewActions && 'max-[379px]:row-span-2')}
            aria-hidden='true'
          >
            {preview}
          </div>
          {status}
          {previewActions ? (
            <div className='col-span-full flex flex-wrap items-center justify-end gap-1 @min-[24rem]/upload:col-span-1 [&>button]:gap-1.5 [&>button]:px-2'>
              {picker}
              {previewActions}
            </div>
          ) : (
            picker
          )}
        </Surface>
      ) : (
        <>
          {picker}
          {status}
        </>
      )}
    </div>
  )
}
