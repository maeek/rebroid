import { useCallback, useRef, type ReactElement } from 'react'
import { IconAlertTriangle, IconClock, IconHelp, IconMinus, IconX } from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { NavigationHealthStatus } from './platform-health-context'
import type { NavigationVariant } from './protected-navigation-config'

const icons = {
  Checking: IconClock,
  Degraded: IconAlertTriangle,
  Unhealthy: IconAlertTriangle,
  Offline: IconX,
  Unknown: IconHelp,
  Disabled: IconMinus
}

const tones = { neutral: 'text-foreground-muted', warning: 'text-warning', danger: 'text-danger' } as const
const sidebarGap = 8

export const NavigationHealth = ({
  status,
  compact = false
}: {
  status?: NavigationHealthStatus
  compact?: boolean
}) => {
  if (!status) return null
  const Icon = icons[status.label]
  if (compact) {
    return (
      <span
        aria-hidden='true'
        data-slot='navigation-health'
        className={cn('absolute right-1 top-1 size-1.5 rounded-full bg-current', tones[status.tone])}
      />
    )
  }
  return (
    <span
      aria-hidden='true'
      data-slot='navigation-health'
      className='ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-normal text-foreground-muted'
    >
      <Icon className={cn('size-3.5', tones[status.tone])} />
      {status.label}
    </span>
  )
}

export const NavigationHealthDetails = ({ label, status }: { label: string; status: NavigationHealthStatus }) => (
  <>
    <span className='flex items-center gap-3 text-sm font-medium text-foreground'>
      {label}
      <NavigationHealth status={status} />
    </span>
    <span className='mt-1 block text-xs leading-relaxed wrap-anywhere text-foreground-muted'>{status.description}</span>
  </>
)

export const NavigationHealthHint = ({
  label,
  status,
  variant,
  children
}: {
  label: string
  status?: NavigationHealthStatus
  variant: NavigationVariant
  children: ReactElement
}) => {
  const triggerRef = useRef<HTMLElement>(null)
  const setTrigger = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element
  }, [])
  const getSidebarOffset = () => {
    const row = triggerRef.current
    const sidebar = row?.closest('aside')
    if (!row || !sidebar) return sidebarGap
    return sidebarGap + Math.max(0, sidebar.getBoundingClientRect().right - row.getBoundingClientRect().right)
  }

  if (variant === 'drawer') return children
  return (
    <Tooltip disabled={!status && variant !== 'rail'}>
      <TooltipTrigger
        ref={setTrigger}
        asChild
        delay={status ? 200 : 0}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        data-slot='navigation-hint'
        side='right'
        align={status ? 'start' : 'center'}
        sideOffset={status ? getSidebarOffset : 22}
        className={
          status &&
          'w-56 max-w-(--available-width) rounded-panel border-surface-border/60 bg-surface-editor px-3 py-2.5 touch:hidden'
        }
      >
        {status ? (
          <NavigationHealthDetails
            label={label}
            status={status}
          />
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  )
}
