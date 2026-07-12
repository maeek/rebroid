'use client'

import { createContext, useContext, useId, type KeyboardEvent, type ReactNode } from 'react'
import { focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

type TabsContextValue = {
  baseId: string
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

const useTabsContext = () => {
  const context = useContext(TabsContext)
  if (!context) throw new Error('Tabs components must be rendered inside TabsRoot.')
  return context
}

export const TabsRoot = ({
  children,
  className,
  idPrefix,
  value,
  onValueChange
}: {
  children: ReactNode
  className?: string
  idPrefix?: string
  value: string
  onValueChange: (value: string) => void
}) => {
  const generatedId = useId()
  const baseId = idPrefix ?? generatedId

  return (
    <TabsContext.Provider value={{ baseId, value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export const TabsList = ({
  actions,
  ariaLabel,
  children,
  className,
  variant = 'segmented'
}: {
  actions?: ReactNode
  ariaLabel: string
  children: ReactNode
  className?: string
  variant?: 'segmented' | 'scrollable' | 'immersive'
}) => (
  <div className={cn('flex min-w-0 items-center gap-2', className)}>
    <div
      role='tablist'
      aria-label={ariaLabel}
      data-variant={variant}
      className={cn('min-w-0 flex-1', {
        'flex rounded-control border border-surface-border/70 bg-surface-band/35 p-1': variant === 'segmented',
        'scrollbar-thin flex gap-1 overflow-x-auto rounded-panel border border-surface-border/60 bg-surface-band/28 p-1.5':
          variant === 'scrollable',
        'scrollbar-thin flex gap-1 overflow-x-auto': variant === 'immersive'
      })}
    >
      {children}
    </div>
    {actions ? <div className='shrink-0'>{actions}</div> : null}
  </div>
)

const focusTab = (event: KeyboardEvent<HTMLButtonElement>, offset: number | 'first' | 'last') => {
  const tabList = event.currentTarget.closest('[role="tablist"]')
  const tabs = Array.from(tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [])
  const currentIndex = tabs.indexOf(event.currentTarget)
  if (currentIndex < 0 || tabs.length === 0) return

  let nextIndex = currentIndex
  if (offset === 'first') nextIndex = 0
  else if (offset === 'last') nextIndex = tabs.length - 1
  else nextIndex = (currentIndex + offset + tabs.length) % tabs.length

  event.preventDefault()
  tabs[nextIndex]?.focus()
  tabs[nextIndex]?.click()
}

export const TabsTrigger = ({
  children,
  className,
  disabled,
  value
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
  value: string
}) => {
  const context = useTabsContext()
  const active = context.value === value

  return (
    <button
      type='button'
      role='tab'
      id={`${context.baseId}-tab-${value}`}
      aria-controls={`${context.baseId}-panel-${value}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      className={cn(
        focusRingClassName,
        'flex min-h-8 flex-1 items-center justify-center gap-2 rounded-control border border-transparent px-3 text-sm font-medium whitespace-nowrap text-foreground-muted transition-[color,background-color,border-color,box-shadow] hover:bg-control/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
        active && 'border-surface-border/65 bg-control text-foreground shadow-control',
        className
      )}
      onClick={() => context.onValueChange(value)}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft') focusTab(event, -1)
        else if (event.key === 'ArrowRight') focusTab(event, 1)
        else if (event.key === 'Home') focusTab(event, 'first')
        else if (event.key === 'End') focusTab(event, 'last')
      }}
    >
      {children}
    </button>
  )
}

export const TabsPanel = ({
  children,
  className,
  value
}: {
  children: ReactNode
  className?: string
  value: string
}) => {
  const context = useTabsContext()
  const active = context.value === value

  return (
    <div
      role='tabpanel'
      id={`${context.baseId}-panel-${value}`}
      aria-labelledby={`${context.baseId}-tab-${value}`}
      hidden={!active}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}
