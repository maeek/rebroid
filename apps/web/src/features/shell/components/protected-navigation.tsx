'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Visible } from '@/components/ui/visible'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getBff } from '@/lib/http/bff'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { recentAppsUpdatedEvent } from '@/shared/model/recent-apps/recent-apps'
import { NavigationRail } from './navigation-rail-group'
import {
  administrationEntries,
  appSections,
  isNavigationDestinationActive,
  automationSections,
  overviewSections,
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
  pollRecentApps: boolean
  onNavigate?: () => void
}

export const ProtectedNavigation = ({ variant, initialUser, pollRecentApps, onNavigate }: ProtectedNavigationProps) => {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { data: recentApps = [], mutate: refreshRecentApps } = usePollingQuery<RecentApp[]>(
    'navigation:recent-apps',
    () => getBff<RecentApp[]>('/api/bff/shell/recent-apps'),
    { enabled: pollRecentApps, intervalMs: 5000 }
  )
  const isAdmin = initialUser.isPlatformAdmin
  const { isFeatureEnabled } = useFeatureFlags()
  const styles = variantStyles[variant]

  useEffect(() => {
    if (!pollRecentApps) return
    const onRecentAppsUpdated = () => void refreshRecentApps()

    window.addEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    return () => {
      window.removeEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    }
  }, [pollRecentApps, refreshRecentApps])

  const isActivePath = (href: string, exact = false) => isNavigationDestinationActive(pathname, href, exact)

  const itemIsActive = (href: string) => {
    if (href === '/platform/runtime' && isActivePath('/platform/console')) return true

    return isActivePath(href, href === '/platform')
  }

  const isItemVisible = (item: NavigationItem) => !item.feature || isFeatureEnabled(item.feature)
  const visibleAdministration = administrationEntries
    .filter(entry => 'items' in entry || isItemVisible(entry))
    .map(entry => {
      if (!('items' in entry)) return entry
      const items = entry.items.filter(isItemVisible).map(item => {
        const feature = item.shortcut?.feature
        return feature && !isFeatureEnabled(feature) ? { ...item, shortcut: undefined } : item
      })
      return { ...entry, items }
    })

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

      <Visible when={isFeatureEnabled('feature.workflows')}>
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
      </Visible>

      <Visible when={isAdmin}>
        <SectionHeader
          title='Administration'
          variant={variant}
        />
        {variant === 'rail' ? (
          <NavigationRail
            entries={visibleAdministration}
            isActivePath={itemIsActive}
          />
        ) : (
          <ul className={styles.list}>
            {visibleAdministration.map(entry => {
              if (!('items' in entry)) {
                return (
                  <NavLink
                    key={entry.href}
                    href={entry.href}
                    label={entry.name}
                    healthId={entry.healthId}
                    Icon={entry.Icon}
                    isActive={itemIsActive(entry.href)}
                    variant={variant}
                    onNavigate={onNavigate}
                  />
                )
              }
              const { label, items, href, Icon, healthId } = entry
              if (!items.length) return null
              const isOpen = expanded[label] ?? true
              return (
                <NestedNavigationMenu
                  key={label}
                  label={label}
                  href={href}
                  Icon={Icon}
                  healthId={healthId}
                  items={items}
                  variant={variant}
                  isOpen={isOpen}
                  isActivePath={itemIsActive}
                  onNavigate={onNavigate}
                  onToggle={() => setExpanded(current => ({ ...current, [label]: !isOpen }))}
                />
              )
            })}
          </ul>
        )}
      </Visible>
    </div>
  )
}
