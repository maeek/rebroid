import type { ReactNode } from 'react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { cn } from '@/lib/utils'

export const AiUserMessage = ({ children }: { children: ReactNode }) => (
  <div className='ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm'>
    {children}
  </div>
)

export const AiAssistantBlock = ({
  title = 'AI agent',
  meta,
  children,
  className
}: {
  title?: string
  meta?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <div className={cn('grid gap-2 rounded-lg border border-border/55 bg-surface-band/24 p-3', className)}>
    <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
      <div className='flex min-w-0 items-center gap-2'>
        <GradientSparklesIcon className='size-4 shrink-0' />
        <span className='truncate text-sm font-medium'>{title}</span>
      </div>
      {meta ? <div className='shrink-0'>{meta}</div> : null}
    </div>
    {children}
  </div>
)

export const AiAssistantText = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <div className={cn('whitespace-pre-wrap text-sm', muted ? 'text-foreground-muted' : 'text-foreground')}>
    {children}
  </div>
)

export const AiToolDetails = ({ children, className }: { children: ReactNode; className?: string }) => (
  <dl
    className={cn(
      'grid max-w-full gap-1 rounded-md bg-background/20 p-2 text-[11px] text-muted-foreground/80',
      className
    )}
  >
    {children}
  </dl>
)
