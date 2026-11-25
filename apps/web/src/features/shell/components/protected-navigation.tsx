'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { navigationAppsLimit } from '@/shared/model/recent-apps/recent-apps'
import { NavigationRail } from './navigation-rail-group'
import {
  administrationEntries,
  apkLibraryNavigationItem,
  appsNavigationItem,
  canBrowseDevices,
  externalDevicesNavigationItem,
  isNavigationDestinationActive,
  automationSections,
  overviewSections,
  variantStyles,
  type NavigationItem,
  type NavigationVariant
} from './protected-navigation-config'
import { NavLink, NestedNavigationMenu, SectionHeader } from './protected-navigation-parts'
import { RecentAppLink } from './recent-app-link'
import type { ShellNavigationHandler } from './shell-navigation-handler'
import type { ShellUser } from './shell-user'
import type { RecentApp } from '@/shared/contracts/recent-app'

export type RecentAppsQuery = {
  data: RecentApp[] | undefined
  isLoading: boolean
  mutate: () => Promise<RecentApp[] | undefined>
}

type ProtectedNavigationProps = {
  variant: NavigationVariant
  initialUser: ShellUser
  recentAppsQuery: RecentAppsQuery
  reserveRecentApps?: boolean
  onNavigate?: ShellNavigationHandler
  onClose?: () => void
}

export const ProtectedNavigation = ({
  variant,
  initialUser,
  recentAppsQuery,
  reserveRecentApps,
  onNavigate,
  onClose
}: ProtectedNavigationProps) => {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { data: recentApps = [], isLoading, mutate: refreshRecentApps } = recentAppsQuery
  const reservedRowCount = reserveRecentApps ? Math.max(0, navigationAppsLimit - recentApps.length) : 0
  const isAdmin = initialUser.isPlatformAdmin
  const { isFeatureEnabled } = useFeatureFlags()
  const externalDevicesEnabled = isFeatureEnabled('feature.external-devices')
  const canOpenExternalDevices = canBrowseDevices(initialUser, externalDevicesEnabled)
  const styles = variantStyles[variant]

  const isActivePath = (href: string, exact = false) => isNavigationDestinationActive(pathname, href, exact)

  const itemIsActive = (href: string) => {
    if (href === '/platform/runtime' && isActivePath('/platform/console')) return true

    return isActivePath(href, href === '/platform')
  }

  const isItemVisible = (item: NavigationItem) => !item.feature || isFeatureEnabled(item.feature)
  const administrativeItems = isAdmin ? administrationEntries : []
  const visibleAdministration = [
    ...(initialUser.canReviewApks ? [apkLibraryNavigationItem] : []),
    ...administrativeItems
  ]
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
        actionHref={initialUser.canCreateApp ? '/apps/new' : undefined}
        actionLabel='Create app'
        onNavigate={onNavigate}
      />
      <ul className={styles.list}>
        <NavLink
          href={appsNavigationItem.href}
          label={appsNavigationItem.name}
          Icon={appsNavigationItem.Icon}
          isActive={pathname === appsNavigationItem.href}
          variant={variant}
          onNavigate={onNavigate}
        />
        {recentApps
          .filter(app => !app.connectionHref)
          .map(app => (
            <RecentAppLink
              key={app.id}
              app={app}
              variant={variant}
              isActive={isActivePath(app.href ?? `/apps/${app.id}`)}
              onNavigate={onNavigate}
              onClose={onClose}
              onStarted={() => void refreshRecentApps()}
            />
          ))}
        {Array.from({ length: reservedRowCount }, (_, index) => (
          <li
            key={index}
            aria-hidden='true'
            className='flex min-h-12 items-center gap-2 px-2'
          >
            {isLoading ? (
              <>
                <Skeleton className='size-8 rounded-control' />
                <Skeleton className='h-3 w-28' />
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {canOpenExternalDevices ? (
        <>
          <SectionHeader
            title='Devices'
            variant={variant}
            actionHref={initialUser.canEnrollExternalDevices && externalDevicesEnabled ? '/devices/new' : undefined}
            actionLabel='Register device'
            onNavigate={onNavigate}
          />
          <ul className={styles.list}>
            <NavLink
              href={externalDevicesNavigationItem.href}
              label={externalDevicesNavigationItem.name}
              Icon={externalDevicesNavigationItem.Icon}
              isActive={pathname === externalDevicesNavigationItem.href}
              variant={variant}
              onNavigate={onNavigate}
            />
            {recentApps
              .filter(app => app.connectionHref)
              .map(app => (
                <RecentAppLink
                  key={app.id}
                  app={app}
                  variant={variant}
                  isActive={pathname === app.href}
                  onNavigate={onNavigate}
                  onClose={onClose}
                  onStarted={() => void refreshRecentApps()}
                />
              ))}
          </ul>
        </>
      ) : null}

      <Visible when={initialUser.canManageWorkflows === true && isFeatureEnabled('feature.workflows')}>
        <SectionHeader
          title='Automations'
          variant={variant}
        />
        <ul className={styles.list}>
          {automationSections.map(({ name, Icon, href, shortcut }) => (
            <NavLink
              key={name}
              href={href}
              label={name}
              Icon={Icon}
              isActive={isActivePath(href, href === '/automations')}
              shortcut={shortcut}
              variant={variant}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </Visible>

      <Visible when={visibleAdministration.length > 0}>
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
