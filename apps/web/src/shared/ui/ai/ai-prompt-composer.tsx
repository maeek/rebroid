import type { ReactNode } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export const AiPromptComposer = ({
  value,
  placeholder,
  rows = 4,
  variant = 'panel',
  disabled,
  className,
  textareaClassName,
  metadata,
  modelControl,
  actions,
  errors,
  onChange,
  onSubmit
}: {
  value: string
  placeholder: string
  rows?: number
  variant?: 'panel' | 'plain'
  disabled?: boolean
  className?: string
  textareaClassName?: string
  metadata?: ReactNode
  modelControl?: ReactNode
  actions?: ReactNode
  errors?: Array<string | null | undefined>
  onChange: (value: string) => void
  onSubmit?: () => void
}) => {
  const visibleErrors = (errors ?? []).filter((message): message is string => Boolean(message))

  return (
    <div
      className={cn(
        variant === 'panel'
          ? 'rounded-lg border border-border/70 bg-surface-panel/34 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'
          : 'p-0',
        className
      )}
    >
      <Textarea
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (!onSubmit) return
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            onSubmit()
          }
        }}
        className={cn(
          variant === 'panel'
            ? 'min-h-24 resize-none border-0 bg-transparent p-1 shadow-none hover:bg-transparent focus-visible:ring-0'
            : 'min-h-24 resize-none px-3 py-3',
          textareaClassName
        )}
      />
      {visibleErrors.length > 0 ? (
        <div className='mt-2 grid gap-1'>
          {visibleErrors.map(message => (
            <div
              key={message}
              className='text-xs text-destructive'
            >
              {message}
            </div>
          ))}
        </div>
      ) : null}
      <div className='mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3'>
        <div className='min-w-0 text-xs text-foreground-muted'>{metadata}</div>
        <div className='flex min-w-0 flex-wrap items-center justify-end gap-2'>
          {modelControl}
          {actions}
        </div>
      </div>
    </div>
  )
}
