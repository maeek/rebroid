'use client'

import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { focusRingClassName } from '@/components/ui/surface'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { NavigationControls } from './navigation-controls/navigation-controls'
import { NavigationHint } from './navigation-hint'
import { ProtectedNavigation } from './protected-navigation'
import { RebroidIcon } from './rebroid-icon'
import styles from './rebroid-wordmark.module.css'
import type { ShellUser } from './shell-user'

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
  const ToggleIcon = collapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse
  const home = (
    <Link
      href='/'
      aria-label='Rebroid'
      className={cn(
        'touch-control inline-flex h-9 min-w-0 items-center rounded-control px-1.5',
        focusRingClassName,
        collapsed ? 'w-9 touch:min-w-0' : 'max-w-44'
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
      className='fixed inset-y-[var(--shell-sidebar-inset)] left-[var(--shell-sidebar-inset)] z-40 hidden w-(--shell-sidebar-width) flex-col overflow-hidden rounded-panel bg-surface-navigation transition-[width] duration-[var(--shell-sidebar-duration)] ease-out lg:flex motion-reduce:transition-none'
    >
      <div
        className={cn(
          'relative shrink-0 transition-[height] duration-[var(--shell-sidebar-duration)] ease-out motion-reduce:transition-none',
          collapsed ? 'h-20' : 'h-12'
        )}
      >
        <div className={cn('absolute top-1.5 flex items-center', collapsed ? 'left-3.5' : 'left-[13px]')}>
          {collapsed ? <NavigationHint label='Rebroid'>{home}</NavigationHint> : home}
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
                'absolute right-[13px] transition-[top] duration-[var(--shell-sidebar-duration)] ease-out motion-reduce:transition-none',
                collapsed ? 'top-11' : 'top-1.5'
              )}
              aria-label={toggleLabel}
              aria-controls={sidebarId}
              aria-expanded={!collapsed}
              onClick={onToggle}
            >
              <ToggleIcon className='size-5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side={collapsed ? 'right' : 'bottom'}
            align={collapsed ? 'center' : 'end'}
            sideOffset={8}
          >
            {toggleLabel}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className='scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain'>
        <div className={collapsed ? 'w-16' : 'w-72'}>
          <ProtectedNavigation
            variant={collapsed ? 'rail' : 'sidebar'}
            initialUser={initialUser}
          />
        </div>
      </div>
      <NavigationControls
        user={initialUser}
        placement={collapsed ? 'rail' : 'sidebar'}
        polling={pollNavigation}
      />
    </aside>
  )
}
