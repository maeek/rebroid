'use client'

import { useId, useRef, useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
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
  return (
    <div
      className={cn('flex min-w-0 w-full flex-wrap items-center gap-3', className)}
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
      <Button
        type='button'
        variant='outline'
        disabled={disabled || pending}
        aria-controls={inputId}
        aria-label={props['aria-label'] ? `Choose ${props['aria-label']}` : undefined}
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        onClick={() => input.current?.click()}
      >
        {pending ? pendingLabel : buttonLabel}
      </Button>
      <span
        className='min-w-0 break-all text-xs text-foreground-muted'
        role='status'
      >
        {filenameLabel || filename || emptyLabel}
      </span>
    </div>
  )
}
