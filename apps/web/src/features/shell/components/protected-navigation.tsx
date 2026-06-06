'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Visible } from '@/components/ui/visible'
import { recentAppsUpdatedEvent, type RecentApp } from '@/features/applications/recent/recent-apps'
import { usePollingQuery } from '@/hooks/use-polling-query'
import {
  checkAutomationAiProviderHealthAction,
  listAutomationAiModelCatalogAction
} from '@/server/orchestrator/settings/actions'
import { listRecentAppsAction } from '@/server/recent-apps/actions'
import {
  appSections,
  automationSections,
  infrastructureSections,
  operationsSections,
  orchestratorSections,
  preferenceSections,
  userSections,
  variantStyles,
  type NavigationItem,
  type NavigationVariant
} from './protected-navigation-config'
import { NavLink, SectionHeader } from './protected-navigation-parts'
import { RecentAppLink } from './recent-app-link'
import type { ShellUser } from './shell-user'

type ProtectedNavigationProps = {
  variant: NavigationVariant
  initialUser: ShellUser
  onNavigate?: () => void
}

export const ProtectedNavigation = ({ variant, initialUser, onNavigate }: ProtectedNavigationProps) => {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [role, setRole] = useState(initialUser.role)
  const [hasHealthyAiProvider, setHasHealthyAiProvider] = useState(false)
  const { data: recentApps = [], mutate: refreshRecentApps } = usePollingQuery<RecentApp[]>(
    'navigation:recent-apps',
    () => listRecentAppsAction(),
    { intervalMs: 5000 }
  )
  const isAdmin = role === 'admin'
  const styles = variantStyles[variant]

  useEffect(() => {
    if (session?.user.role) setRole(session.user.role)
  }, [session?.user.role])

  useEffect(() => {
    const onRecentAppsUpdated = () => void refreshRecentApps()

    window.addEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    return () => {
      window.removeEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    }
  }, [refreshRecentApps])

  useEffect(() => {
    if (!isAdmin) {
      setHasHealthyAiProvider(false)
      return
    }

    let cancelled = false

    const checkAiProviderReachability = async () => {
      try {
        const catalog = await listAutomationAiModelCatalogAction()
        const candidates = catalog
          .map(provider => ({
            provider,
            model: provider.models.find(model => model.default) ?? provider.models[0]
          }))
          .filter(item => item.model)
        const results = await Promise.allSettled(
          candidates.map(({ provider, model }) => checkAutomationAiProviderHealthAction(provider.id, model.id))
        )

        if (cancelled) return
        setHasHealthyAiProvider(results.some(result => result.status === 'fulfilled' && result.value.status === 'ok'))
      } catch {
        if (!cancelled) setHasHealthyAiProvider(false)
      }
    }

    void checkAiProviderReachability()
    const interval = window.setInterval(() => void checkAiProviderReachability(), 60_000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isAdmin])

  const isActivePath = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  const itemIsActive = (href: string) => {
    if (href === '/users') {
      return pathname === href || (pathname.startsWith('/users/') && !pathname.startsWith('/users/groups'))
    }

    return isActivePath(href, href === '/orchestrator')
  }

  const renderSection = (title: string, items: NavigationItem[]) => (
    <>
      <SectionHeader
        title={title}
        variant={variant}
      />
      <ul className={styles.list}>
        {items.map(({ name, Icon, href }) => {
          const NavIcon = name === 'AI' && hasHealthyAiProvider ? GradientSparklesIcon : Icon

          return (
            <NavLink
              key={href}
              href={href}
              label={name}
              Icon={NavIcon}
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
        {renderSection('Users', userSections)}
        {renderSection('Orchestrator', orchestratorSections)}
        {renderSection('Infrastructure', infrastructureSections)}
        {renderSection('Operations', operationsSections)}
        {renderSection('Preferences', preferenceSections)}
      </Visible>
    </div>
  )
}
