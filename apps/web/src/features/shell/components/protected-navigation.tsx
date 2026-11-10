'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Visible } from '@/components/ui/visible'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getBff } from '@/lib/http/bff'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { recentAppsUpdatedEvent } from '@/shared/model/recent-apps/recent-apps'
import {
  appSections,
  isNavigationDestinationActive,
  automationSections,
  overviewSections,
  platformSections,
  preferenceSections,
  runtimeSections,
  securitySections,
  systemSections,
  variantStyles,
  type NavigationItem,
  type NavigationVariant
} from './protected-navigation-config'
import { NavLink, NestedNavigationMenu, SectionHeader } from './protected-navigation-parts'
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
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

  const isActivePath = (href: string, exact = false) => isNavigationDestinationActive(pathname, href, exact)

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
      {isAdmin ? (
        <ul className={styles.list}>
          {overviewSections.map(({ name, Icon, href }) => (
            <NavLink
              key={href}
              href={href}
              label={name}
              Icon={Icon}
              isActive={itemIsActive(href)}
              variant={variant}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
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
        actionLabel='Create workflow'
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
        <SectionHeader
          title='Administration'
          variant={variant}
        />
        <ul className={styles.list}>
          {[
            { label: 'Platform settings', items: platformSections },
            { label: 'Infrastructure', items: [...runtimeSections, ...systemSections] },
            { label: 'Access and policies', items: securitySections }
          ].map(group => {
            const items = group.items
              .filter(item => !item.feature || isFeatureEnabled(item.feature))
              .map(item => ({
                ...item,
                shortcut: item.shortcut?.feature && !isFeatureEnabled(item.shortcut.feature) ? undefined : item.shortcut
              }))
            const first = items[0]
            if (!first) return null
            const active = items.some(item => itemIsActive(item.href))
            const isOpen = expanded[group.label] ?? active
            return (
              <NestedNavigationMenu
                key={group.label}
                label={group.label}
                Icon={first.Icon}
                items={items}
                variant={variant}
                isOpen={isOpen}
                isActivePath={itemIsActive}
                onNavigate={onNavigate}
                onToggle={() => setExpanded(current => ({ ...current, [group.label]: !isOpen }))}
              />
            )
          })}
        </ul>
        {renderSection('Preferences', preferenceSections)}
      </Visible>
    </div>
  )
}
