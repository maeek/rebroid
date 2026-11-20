'use client'

import { IconChevronRight, IconLayoutSidebarLeftCollapse } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { focusRingClassName } from '@/components/ui/surface'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { RebroidIcon } from '@/shared/ui/branding/rebroid-icon'
import { NavigationControls } from './navigation-controls/navigation-controls'
import { NavigationHint } from './navigation-hint'
import { ProtectedNavigation } from './protected-navigation'
import type { ShellUser } from './shell-user'
import styles from '@/shared/ui/branding/rebroid-wordmark.module.css'

const sidebarId = 'desktop-navigation'

export default function Sidebar({
  initialUser,
  collapsed,
  onToggle,
  pollNavigation
}: {
  initialUser: ShellUser
  collapsed: boolean
  onToggle: () => void
  pollNavigation: boolean
}) {
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  const ToggleIcon = collapsed ? IconChevronRight : IconLayoutSidebarLeftCollapse
  const home = (
    <Link
      href='/'
      aria-label='Rebroid'
      className={cn(
        'touch-control inline-flex h-9 min-w-0 items-center rounded-control px-1.5',
        focusRingClassName,
        collapsed ? 'w-9 touch:min-w-0 touch:pl-3' : 'max-w-44'
      )}
    >
      <RebroidIcon />
      <span
        aria-hidden={collapsed}
        className={cn(
          styles.wordmark,
          'truncate text-lg font-bold transition-[max-width,margin,opacity] duration-[var(--shell-sidebar-duration)] motion-reduce:transition-none',
          collapsed ? 'max-w-0 opacity-0' : 'ml-2 max-w-32 opacity-100'
        )}
      >
        Rebroid
      </span>
    </Link>
  )

  return (
    <aside
      id={sidebarId}
      aria-label='Primary navigation'
      className='group/sidebar fixed inset-y-[var(--shell-sidebar-inset)] left-[var(--shell-sidebar-inset)] z-40 hidden w-(--shell-sidebar-width) flex-col rounded-panel bg-surface-navigation transition-[width] duration-[var(--shell-sidebar-duration)] ease-out lg:flex motion-reduce:transition-none'
    >
      <div className='relative h-12 shrink-0'>
        <div className={cn('absolute top-1.5 flex items-center', collapsed ? 'left-3.5 touch:left-2' : 'left-[13px]')}>
          {collapsed ? (
            <NavigationHint
              label='Rebroid'
              side='bottom'
            >
              {home}
            </NavigationHint>
          ) : (
            home
          )}
        </div>
        <Tooltip>
          <TooltipTrigger
            asChild
            delay={0}
          >
            <Button
              type='button'
              variant='ghost'
              size='icon-md'
              className={cn(
                'absolute top-1.5 right-[13px] transition-[translate,background-color,color,opacity] ease-out [transition-duration:var(--shell-sidebar-duration),150ms,150ms,120ms] motion-reduce:transition-none',
                collapsed &&
                  'translate-x-[35px] text-foreground-muted group-hover/sidebar:opacity-100 focus-visible:opacity-100 touch:translate-x-[37px] [@media(hover:hover)_and_(pointer:fine)]:opacity-0'
              )}
              aria-label={toggleLabel}
              aria-controls={sidebarId}
              aria-expanded={!collapsed}
              onClick={onToggle}
            >
              <ToggleIcon
                aria-hidden='true'
                className={collapsed ? 'size-4' : 'size-5'}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side='bottom'
            align='end'
            sideOffset={8}
          >
            {toggleLabel}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-panel'>
        <div className='scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain'>
          <div className={collapsed ? 'w-16' : 'w-72'}>
            <ProtectedNavigation
              variant={collapsed ? 'rail' : 'sidebar'}
              initialUser={initialUser}
              pollRecentApps={pollNavigation}
            />
          </div>
        </div>
        <NavigationControls
          user={initialUser}
          placement={collapsed ? 'rail' : 'sidebar'}
        />
      </div>
    </aside>
  )
}
