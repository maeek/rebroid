'use client'

import { useId, type ReactNode, type Ref } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export const AiPromptComposer = ({
  value,
  placeholder,
  ariaLabel = 'Message',
  textareaRef,
  rows = 4,
  variant = 'panel',
  disabled,
  className,
  textareaClassName,
  metadata,
  status,
  leadingControl,
  modelControl,
  actions,
  errors,
  onChange,
  onSubmit,
  submitOnEnter = false
}: {
  value: string
  placeholder: string
  ariaLabel?: string
  textareaRef?: Ref<HTMLTextAreaElement>
  rows?: number
  variant?: 'panel' | 'plain'
  disabled?: boolean
  className?: string
  textareaClassName?: string
  metadata?: ReactNode
  status?: ReactNode
  leadingControl?: ReactNode
  modelControl?: ReactNode
  actions?: ReactNode
  errors?: Array<string | null | undefined>
  onChange: (value: string) => void
  onSubmit?: () => void
  submitOnEnter?: boolean
}) => {
  const errorId = useId()
  const visibleErrors = (errors ?? []).filter((message): message is string => Boolean(message))

  return (
    <div
      className={cn(
        variant === 'panel'
          ? 'rounded-feature border border-control-border/25 bg-control p-3 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring'
          : 'p-0',
        className
      )}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        aria-label={ariaLabel}
        aria-describedby={visibleErrors.length > 0 ? errorId : undefined}
        aria-invalid={visibleErrors.length > 0 || undefined}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (!onSubmit) return
          const keyboardEvent = event.nativeEvent
          const submitWithEnter = submitOnEnter && event.key === 'Enter' && !event.shiftKey
          const submitWithShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter'
          if ((submitWithEnter || submitWithShortcut) && !keyboardEvent.isComposing) {
            event.preventDefault()
            onSubmit()
          }
        }}
        className={cn(
          variant === 'panel'
            ? 'min-h-16 max-h-40 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 shadow-none hover:bg-transparent focus-visible:ring-0'
            : 'min-h-24 resize-none px-3 py-3',
          textareaClassName
        )}
      />
      {visibleErrors.length > 0 ? (
        <div
          id={errorId}
          role='alert'
          className='mt-2 grid gap-1'
        >
          {visibleErrors.map(message => (
            <div
              key={message}
              className='text-xs text-danger'
            >
              {message}
            </div>
          ))}
        </div>
      ) : null}
      {status ? (
        <div
          className='px-1 pt-1 text-xs leading-5 text-foreground-muted'
          role='status'
        >
          {status}
        </div>
      ) : null}
      <div className='mt-2 flex min-w-0 items-center gap-2'>
        {leadingControl ? <div className='shrink-0'>{leadingControl}</div> : null}
        <div className='ml-auto min-w-0 max-w-full'>{modelControl}</div>
        {actions ? <div className='flex shrink-0 items-center justify-end gap-2'>{actions}</div> : null}
      </div>
      {metadata ? <div className='mt-2 text-xs leading-5 text-foreground-muted'>{metadata}</div> : null}
    </div>
  )
}
