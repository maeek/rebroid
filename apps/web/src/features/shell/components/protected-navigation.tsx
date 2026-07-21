'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Visible } from '@/components/ui/visible'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getBff } from '@/lib/http/bff'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { recentAppsUpdatedEvent } from '@/shared/model/recent-apps/recent-apps'
import {
  appSections,
  automationSections,
  platformSections,
  preferenceSections,
  runtimeSections,
  securitySections,
  systemSections,
  variantStyles,
  type NavigationItem,
  type NavigationVariant
} from './protected-navigation-config'
import { NavLink, SectionHeader } from './protected-navigation-parts'
import { RecentAppLink } from './recent-app-link'
import type { ShellUser } from './shell-user'
import type { RecentApp } from '@/shared/contracts/recent-app'

type ProtectedNavigationProps = {
  variant: NavigationVariant
  initialUser: ShellUser
  onNavigate?: () => void
}

export const ProtectedNavigation = ({ variant, initialUser, onNavigate }: ProtectedNavigationProps) => {
  const pathname = usePathname()
  const { data: recentApps = [], mutate: refreshRecentApps } = usePollingQuery<RecentApp[]>(
    'navigation:recent-apps',
    () => getBff<RecentApp[]>('/api/bff/shell/recent-apps'),
    { intervalMs: 5000 }
  )
  const isAdmin = initialUser.role === 'admin'
  const { isFeatureEnabled } = useFeatureFlags()
  const styles = variantStyles[variant]

  useEffect(() => {
    const onRecentAppsUpdated = () => void refreshRecentApps()

    window.addEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    return () => {
      window.removeEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    }
  }, [refreshRecentApps])

  const isActivePath = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  const itemIsActive = (href: string) => {
    if (href === '/security/users') {
      return pathname === href || (pathname.startsWith('/security/users/') && !pathname.startsWith('/security/groups'))
    }

    return isActivePath(href, href === '/platform')
  }

  const renderSection = (title: string, items: NavigationItem[]) => (
    <>
      <SectionHeader
        title={title}
        variant={variant}
      />
      <ul className={styles.list}>
        {items
          .filter(item => !item.feature || isFeatureEnabled(item.feature))
          .map(({ name, Icon, href }) => {
            return (
              <NavLink
                key={href}
                href={href}
                label={name}
                Icon={Icon}
                isActive={itemIsActive(href)}
                variant={variant}
                onNavigate={onNavigate}
              />
            )
          })}
      </ul>
    </>
  )

  return (
    <div className={styles.root}>
      <SectionHeader
        title='Apps'
        variant={variant}
        actionHref='/apps/create'
        actionLabel='Create app'
        onNavigate={onNavigate}
      />
      <ul className={styles.list}>
        {appSections.map(({ name, Icon, href }) => (
          <NavLink
            key={name}
            href={href}
            label={name}
            Icon={Icon}
            isActive={pathname === href}
            variant={variant}
            onNavigate={onNavigate}
          />
        ))}
        {recentApps.map(app => (
          <RecentAppLink
            key={app.id}
            app={app}
            variant={variant}
            isActive={pathname === `/app/${app.id}` || pathname.startsWith(`/app/${app.id}/`)}
            onNavigate={onNavigate}
            onStarted={() => void refreshRecentApps()}
          />
        ))}
      </ul>

      <SectionHeader
        title='Automations'
        variant={variant}
        actionHref='/automations/create'
        actionLabel='Create automation'
        onNavigate={onNavigate}
      />
      <ul className={styles.list}>
        {automationSections.map(({ name, Icon, href }) => (
          <NavLink
            key={name}
            href={href}
            label={name}
            Icon={Icon}
            isActive={isActivePath(href, href === '/automations')}
            variant={variant}
            onNavigate={onNavigate}
          />
        ))}
      </ul>

      <Visible when={isAdmin}>
        {renderSection('Security', securitySections)}
        {renderSection('Platform', platformSections)}
        {renderSection('Runtime', runtimeSections)}
        {renderSection('System', systemSections)}
        {renderSection('Preferences', preferenceSections)}
      </Visible>
    </div>
  )
}
