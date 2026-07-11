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
  onSubmit,
  submitOnEnter = false
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
  submitOnEnter?: boolean
}) => {
  const visibleErrors = (errors ?? []).filter((message): message is string => Boolean(message))

  return (
    <div
      className={cn(
        variant === 'panel'
          ? 'rounded-feature border border-surface-border/75 bg-surface-panel/72 p-2.5 shadow-[0_18px_48px_-30px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-primary/45 focus-within:bg-surface-panel focus-within:shadow-[0_20px_52px_-28px_hsl(var(--primary)/0.28)]'
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
            ? 'min-h-20 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[13px] leading-5 shadow-none hover:bg-transparent focus-visible:ring-0'
            : 'min-h-24 resize-none px-3 py-3',
          textareaClassName
        )}
      />
      {visibleErrors.length > 0 ? (
        <div className='mt-2 grid gap-1'>
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
      <div className='mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-surface-border/40 pt-2'>
        <div className='min-w-0 text-xs text-foreground-muted'>{metadata}</div>
        <div className='flex min-w-0 flex-wrap items-center justify-end gap-2'>
          {modelControl}
          {actions}
        </div>
      </div>
    </div>
  )
}
