'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { sidebarCollapsedCookie } from '@/shared/model/settings/sidebar-preference'
import { MobileNavigation } from './mobile-navigation'
import Sidebar from './sidebar'
import type { ShellUser } from './shell-user'

const saveSidebarCollapsed = (collapsed: boolean) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${sidebarCollapsedCookie}=${collapsed}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

export const ProtectedShell = ({
  children,
  user,
  initialSidebarCollapsed = false,
  pollNavigation = true
}: {
  children: ReactNode
  user: ShellUser
  initialSidebarCollapsed?: boolean
  pollNavigation?: boolean
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [animateSidebar, setAnimateSidebar] = useState(false)
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  useEffect(() => {
    const viewport = window.matchMedia('(min-width: 64rem)')
    const updateViewport = () => setIsDesktop(viewport.matches)
    updateViewport()
    viewport.addEventListener('change', updateViewport)
    return () => viewport.removeEventListener('change', updateViewport)
  }, [])

  const toggleSidebar = () => {
    const next = !sidebarCollapsed
    setAnimateSidebar(true)
    setSidebarCollapsed(next)
    saveSidebarCollapsed(next)
  }

  return (
    <div
      data-sidebar-collapsed={sidebarCollapsed}
      data-sidebar-motion={animateSidebar}
      className='main-layout relative flex flex-col pt-(--console-top-inset) [--shell-sidebar-duration:0ms] data-[sidebar-motion=true]:[--shell-sidebar-duration:220ms] [--shell-sidebar-inset:0.5rem] [--shell-sidebar-offset:calc(var(--shell-sidebar-width)+var(--shell-sidebar-inset))] [--shell-sidebar-width:18rem] data-[sidebar-collapsed=true]:[--shell-sidebar-width:4rem]'
    >
      <a
        href='#main-content'
        className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-surface-editor focus:px-4 focus:py-2 focus:text-primary focus:outline-2 focus:outline-ring'
      >
        Skip to main content
      </a>
      <Sidebar
        initialUser={user}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        pollNavigation={pollNavigation && isDesktop === true}
      />
      <MobileNavigation
        user={user}
        isDesktop={isDesktop === true}
        pollNavigation={pollNavigation && isDesktop === false}
      />
      <main
        id='main-content'
        tabIndex={-1}
        className='w-full min-w-0 flex-1 scroll-mt-(--console-top-inset) lg:pl-[var(--shell-sidebar-offset)] lg:transition-[padding-left] lg:duration-[var(--shell-sidebar-duration)] lg:ease-out lg:motion-reduce:transition-none'
      >
        <div className='mx-auto flex w-full max-w-[120rem] flex-col'>{children}</div>
      </main>
    </div>
  )
}
