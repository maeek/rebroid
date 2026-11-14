'use client'

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to reveal truncated filenames. */

import { useId, useRef, useState, type ComponentProps } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type FileUploadFieldProps = ComponentProps<'input'> & {
  pendingLabel?: string
  pending?: boolean
  filenameLabel?: string | null
  buttonLabel?: string
  emptyLabel?: string
}

export const FileUploadField = ({
  id,
  className,
  onChange,
  disabled,
  pending,
  pendingLabel = 'Uploading…',
  filenameLabel,
  buttonLabel = 'Choose file',
  emptyLabel = 'No file selected',
  ...props
}: FileUploadFieldProps) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const input = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')
  const displayFilename = filenameLabel ?? (filename || emptyLabel)
  let accessibleLabel = props['aria-label'] ? `Choose ${props['aria-label']}` : undefined
  if (pending) accessibleLabel = pendingLabel
  const statusText = pending ? `${pendingLabel} ${displayFilename}` : displayFilename
  return (
    <div
      data-slot='file-upload-field'
      className={cn('flex min-w-0 w-full items-center gap-3', className)}
      aria-busy={pending}
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
      <MutationButton
        type='button'
        variant='outline'
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
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-slot='file-name'
            role='status'
            className='min-w-0 flex-1 truncate text-xs text-foreground-muted focus-visible:outline-2 focus-visible:outline-ring'
            tabIndex={0}
          >
            {statusText}
          </span>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm break-all'>{statusText}</TooltipContent>
      </Tooltip>
    </div>
  )
}
