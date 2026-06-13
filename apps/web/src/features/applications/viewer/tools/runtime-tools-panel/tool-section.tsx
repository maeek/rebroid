import { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export const ToolSection = ({
  title,
  description,
  icon,
  actions,
  children,
  className,
  hideHeader
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  hideHeader?: boolean
}) => (
  <section
    className={cn(
      'flex w-full flex-col gap-4 px-5 max-md:px-0',
      {
        'rounded-lg border border-border/70 bg-surface-panel/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-md':
          hideHeader
      },
      className
    )}
  >
    <Visible when={!hideHeader || actions}>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className={cn('flex min-w-0 items-center gap-3', hideHeader && 'sr-only')}>
          <Visible when={icon}>
            <div className='text-primary flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors border-border/70 bg-surface-band/50'>
              {icon}
            </div>
          </Visible>
          <div className='min-w-0'>
            <h3 className='font-medium'>{title}</h3>
            <Visible when={!!description}>
              <div className='text-xs text-foreground-muted'>{description}</div>
            </Visible>
          </div>
        </div>
        <Visible when={actions}>
          <div className='flex shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-start'>
            {actions}
          </div>
        </Visible>
      </div>
    </Visible>
    {children}
  </section>
)
