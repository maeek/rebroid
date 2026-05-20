'use client'

import { useEffect, useState, type ElementType } from 'react'
import {
  IconAdjustments,
  IconApps,
  IconBox,
  IconBrandDocker,
  IconChevronDown,
  IconLibraryPlus,
  IconNetwork,
  IconServerSpark,
  IconShield,
  IconUsers
} from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'
import {
  readRecentApps,
  recentAppsStorageKey,
  recentAppsUpdatedEvent,
  type RecentApp
} from '@/features/applications/recent/recent-apps'
import { getAppIconsAction } from '@/server/app-icons/actions/get-app-icons-action'
import { filterAccessibleApplicationIdsAction } from '@/server/orchestrator/applications/read-actions'

type NavigationVariant = 'sidebar' | 'drawer'

type NavigationItem = {
  name: string
  href: string
  Icon: ElementType<{ className?: string }>
}

type ProtectedNavigationProps = {
  variant: NavigationVariant
  onNavigate?: () => void
}

const appSections: NavigationItem[] = [
  { name: 'Installed Apps', Icon: IconApps, href: '/apps' },
  { name: 'Add New App', Icon: IconLibraryPlus, href: '/apps/create' }
]

const settingsSections: NavigationItem[] = [{ name: 'General', Icon: IconAdjustments, href: '/settings/general' }]

const adminSettingsSections: NavigationItem[] = [{ name: 'System', Icon: IconServerSpark, href: '/settings/system' }]

const userManagementSubSections: NavigationItem[] = [
  { name: 'Users', Icon: IconUsers, href: '/settings/users' },
  { name: 'Groups', Icon: IconShield, href: '/settings/users/groups' }
]

const orchestratorSubSections: NavigationItem[] = [
  { name: 'Overview', Icon: IconAdjustments, href: '/settings/orchestrator' },
  { name: 'Containers', Icon: IconBox, href: '/settings/orchestrator/containers' },
  { name: 'Images', Icon: IconBrandDocker, href: '/settings/orchestrator/images' },
  { name: 'Networks', Icon: IconNetwork, href: '/settings/orchestrator/networks' }
]

const variantStyles = {
  sidebar: {
    root: 'w-full py-6 flex flex-col px-2',
    sectionTitle: 'text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm',
    list: 'w-full pb-6 flex flex-col',
    item: 'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-white/5 rounded-sm text-foreground dark:hover:text-white cursor-pointer',
    activeItem: 'bg-white/5 text-primary!',
    iconWrap: 'size-8 rounded-sm flex shrink-0 justify-center items-center',
    icon: 'size-5 max-lg:size-5 stroke-current',
    label: 'text-sm max-lg:text-inherit',
    nestedList: 'min-h-0 space-y-1 py-1 pl-8',
    nestedItem:
      'flex items-center gap-2 rounded-sm px-2 py-1 text-sm text-secondary-foreground transition hover:bg-white/5 hover:text-foreground',
    nestedActiveItem: 'bg-white/5 text-primary!',
    nestedIconWrap: 'flex size-7 shrink-0 items-center justify-center rounded-sm',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-sm text-secondary-foreground transition hover:bg-white/5 hover:text-foreground',
    dashboardSpacing: ''
  },
  drawer: {
    root: 'flex flex-col p-4',
    sectionTitle: 'text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm',
    list: 'w-full pb-6 flex flex-col',
    item: 'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-input rounded-sm text-foreground dark:hover:text-white cursor-pointer',
    activeItem: 'bg-input',
    iconWrap: 'size-8 rounded-sm flex shrink-0 justify-center items-center',
    icon: 'size-5 max-lg:size-5 stroke-current',
    label: 'text-base max-lg:text-inherit text-inherit',
    nestedList: 'min-h-0 space-y-1 py-1 pl-8',
    nestedItem:
      'flex items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground transition hover:bg-input dark:hover:text-white',
    nestedActiveItem: 'bg-input',
    nestedIconWrap: 'flex size-7 shrink-0 items-center justify-center rounded-sm',
    nestedIcon: 'size-4 stroke-current',
    toggleButton:
      'mr-1 flex size-8 items-center justify-center rounded-sm text-secondary-foreground transition hover:bg-input hover:text-foreground',
    dashboardSpacing: 'mb-4'
  }
} as const

type NavLinkProps = {
  href: string
  label: string
  Icon: ElementType<{ className?: string }>
  isActive: boolean
  variant: NavigationVariant
  onNavigate?: () => void
}

const NavLink = ({ href, label, Icon, isActive, variant, onNavigate }: NavLinkProps) => {
  const styles = variantStyles[variant]

  return (
    <Link
      href={href}
      onClick={onNavigate}
    >
      <li className={classNames(styles.item, isActive && styles.activeItem)}>
        <div className={styles.iconWrap}>
          <Icon className={styles.icon} />
        </div>
        <span className={styles.label}>{label}</span>
      </li>
    </Link>
  )
}

type RecentAppLinkProps = {
  app: RecentApp
  variant: NavigationVariant
  isActive: boolean
  onNavigate?: () => void
}

const RecentAppLink = ({ app, variant, isActive, onNavigate }: RecentAppLinkProps) => {
  const styles = variantStyles[variant]

  return (
    <Link
      href={`/app/${app.id}`}
      onClick={onNavigate}
    >
      <li className={classNames(styles.item, isActive && styles.activeItem)}>
        <div className={styles.iconWrap}>
          <AppIcon
            appId={app.id}
            appName={app.name}
            icon={app.icon}
            className='size-6 text-[0.6rem]'
          />
        </div>
        <span className={classNames(styles.label, 'truncate')}>{app.name}</span>
      </li>
    </Link>
  )
}

export const ProtectedNavigation = ({ variant, onNavigate }: ProtectedNavigationProps) => {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const isAdmin = session?.user.role === 'admin'
  const userManagementPathIsActive = pathname.startsWith('/settings/users')
  const orchestratorPathIsActive = pathname.startsWith('/settings/orchestrator')
  const [userManagementMenuIsOpen, setUserManagementMenuIsOpen] = useState(userManagementPathIsActive)
  const [orchestratorMenuIsOpen, setOrchestratorMenuIsOpen] = useState(orchestratorPathIsActive)
  const styles = variantStyles[variant]

  useEffect(() => {
    const hydrateRecentApps = async (apps: RecentApp[]) => {
      let visibleApps = apps
      try {
        const visibleIds = new Set(await filterAccessibleApplicationIdsAction(apps.map(app => app.id)))
        visibleApps = apps.filter(app => visibleIds.has(app.id))
        if (visibleApps.length !== apps.length) {
          window.localStorage.setItem(recentAppsStorageKey, JSON.stringify(visibleApps))
        }
      } catch {
        // Keep local recent-app metadata when the orchestrator cannot validate stale ids.
      }

      setRecentApps(visibleApps)
      const appsMissingIcons = visibleApps.filter(app => !app.icon)
      if (appsMissingIcons.length === 0) {
        return
      }

      try {
        const icons = await getAppIconsAction(appsMissingIcons.map(app => app.id))
        const hydratedApps = visibleApps.map(app => ({ ...app, icon: app.icon ?? icons[app.id] ?? null }))
        setRecentApps(hydratedApps)
        window.localStorage.setItem(recentAppsStorageKey, JSON.stringify(hydratedApps))
      } catch {
        // Keep local recent-app metadata when the server icon store is unavailable.
      }
    }

    void hydrateRecentApps(readRecentApps())

    const onRecentAppsUpdated = (event: Event) => {
      void hydrateRecentApps((event as CustomEvent<RecentApp[]>).detail ?? readRecentApps())
    }

    window.addEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    window.addEventListener('storage', onRecentAppsUpdated)
    return () => {
      window.removeEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
      window.removeEventListener('storage', onRecentAppsUpdated)
    }
  }, [])

  useEffect(() => {
    if (userManagementPathIsActive) {
      setUserManagementMenuIsOpen(true)
    }
  }, [userManagementPathIsActive])

  useEffect(() => {
    if (orchestratorPathIsActive) {
      setOrchestratorMenuIsOpen(true)
    }
  }, [orchestratorPathIsActive])

  const isActivePath = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className={styles.root}>
      <h6 className={styles.sectionTitle}>Apps</h6>
      <ul className={styles.list}>
        {appSections.slice(0, 1).map(({ name, Icon, href }) => (
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
          />
        ))}
        {appSections.slice(1).map(({ name, Icon, href }) => (
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
      </ul>

      <Visible when={isAdmin}>
        <h6 className={styles.sectionTitle}>Settings</h6>
        <ul className={styles.list}>
          {settingsSections.map(({ name, Icon, href }) => (
            <NavLink
              key={name}
              href={href}
              label={name}
              Icon={Icon}
              isActive={isActivePath(href)}
              variant={variant}
              onNavigate={onNavigate}
            />
          ))}
          <li>
            <div className='flex items-center rounded-sm text-foreground dark:hover:text-white'>
              <Link
                href='/settings/users'
                className={classNames(styles.item, 'min-w-0 flex-1 rounded-none bg-transparent')}
                onClick={onNavigate}
              >
                <div className={styles.iconWrap}>
                  <IconUsers className={styles.icon} />
                </div>
                <span className={classNames(styles.label, 'truncate')}>User management</span>
              </Link>
              <button
                type='button'
                className={styles.toggleButton}
                aria-label={userManagementMenuIsOpen ? 'Collapse User management menu' : 'Expand User management menu'}
                aria-expanded={userManagementMenuIsOpen}
                onClick={() => setUserManagementMenuIsOpen(open => !open)}
              >
                <IconChevronDown
                  className={classNames('size-4 transition-transform', userManagementMenuIsOpen && 'rotate-180')}
                />
              </button>
            </div>
            <div
              className={classNames(
                'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
                userManagementMenuIsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              )}
            >
              <ul className={styles.nestedList}>
                {userManagementSubSections.map(({ name, Icon, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                  >
                    <li
                      className={classNames(
                        styles.nestedItem,
                        isActivePath(href, href === '/settings/users') && styles.nestedActiveItem
                      )}
                    >
                      <div className={styles.nestedIconWrap}>
                        <Icon className={styles.nestedIcon} />
                      </div>
                      <span className='truncate'>{name}</span>
                    </li>
                  </Link>
                ))}
              </ul>
            </div>
          </li>
          <li>
            <div className='flex items-center rounded-sm text-foreground dark:hover:text-white'>
              <Link
                href='/settings/orchestrator'
                className={classNames(styles.item, 'min-w-0 flex-1 rounded-none bg-transparent')}
                onClick={onNavigate}
              >
                <div className={styles.iconWrap}>
                  <IconBrandDocker className={styles.icon} />
                </div>
                <span className={classNames(styles.label, 'truncate')}>Orchestrator</span>
              </Link>
              <button
                type='button'
                className={styles.toggleButton}
                aria-label={orchestratorMenuIsOpen ? 'Collapse Orchestrator menu' : 'Expand Orchestrator menu'}
                aria-expanded={orchestratorMenuIsOpen}
                onClick={() => setOrchestratorMenuIsOpen(open => !open)}
              >
                <IconChevronDown
                  className={classNames('size-4 transition-transform', orchestratorMenuIsOpen && 'rotate-180')}
                />
              </button>
            </div>
            <div
              className={classNames(
                'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
                orchestratorMenuIsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              )}
            >
              <ul className={styles.nestedList}>
                {orchestratorSubSections.map(({ name, Icon, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                  >
                    <li
                      className={classNames(
                        styles.nestedItem,
                        isActivePath(href, href === '/settings/orchestrator') && styles.nestedActiveItem
                      )}
                    >
                      <div className={styles.nestedIconWrap}>
                        <Icon className={styles.nestedIcon} />
                      </div>
                      <span className='truncate'>{name}</span>
                    </li>
                  </Link>
                ))}
              </ul>
            </div>
          </li>
          {adminSettingsSections.map(({ name, Icon, href }) => (
            <NavLink
              key={name}
              href={href}
              label={name}
              Icon={Icon}
              isActive={isActivePath(href)}
              variant={variant}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </Visible>
    </div>
  )
}
