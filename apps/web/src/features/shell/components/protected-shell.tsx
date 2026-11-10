'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Sidebar from './sidebar'
import { TopBarProtected } from './top-bar/top-bar'
import type { ShellUser } from './shell-user'

const sidebarPreference = 'rebroid:sidebar-collapsed'

export const ProtectedShell = ({
  children,
  user,
  topBarActions
}: {
  children: ReactNode
  user: ShellUser
  topBarActions?: ReactNode
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem(sidebarPreference) === 'true')
  }, [])

  const toggleSidebar = () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    window.localStorage.setItem(sidebarPreference, String(next))
  }

  return (
    <div className='main-layout relative z-10 pt-16'>
      <a
        href='#main-content'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-surface-editor focus:px-4 focus:py-2 focus:text-primary focus:outline-2 focus:outline-ring'
      >
        Skip to main content
      </a>
      <TopBarProtected
        initialUser={user}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        actions={topBarActions}
      />
      <div className='h-[calc(100%-4rem)] w-full'>
        <Sidebar
          initialUser={user}
          collapsed={sidebarCollapsed}
        />
        <main
          id='main-content'
          tabIndex={-1}
          className={cn('min-h-[calc(100dvh-4rem)] w-full min-w-0 scroll-mt-16', !sidebarCollapsed && 'lg:pl-72')}
        >
          <div className='mx-auto flex w-full max-w-[120rem] flex-col'>{children}</div>
        </main>
      </div>
    </div>
  )
}
