'use client'

import { useEffect, useState, type ElementType } from 'react'
import {
  IconAdjustments,
  IconApps,
  IconBox,
  IconBrandDocker,
  IconCast,
  IconChartHistogram,
  IconChevronDown,
  IconHistory,
  IconLibraryPlus,
  IconLoader2,
  IconNetwork,
  IconPlayerPlayFilled,
  IconServerSpark,
  IconShield,
  IconUsers
} from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'
import { recentAppsUpdatedEvent, type RecentApp } from '@/features/applications/recent/recent-apps'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { startApplicationAction } from '@/server/orchestrator/applications/mutation-actions'
import { listRecentAppsAction } from '@/server/recent-apps/actions'

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
  { name: 'Create', Icon: IconLibraryPlus, href: '/apps/create' }
]

const settingsSections: NavigationItem[] = [{ name: 'General', Icon: IconAdjustments, href: '/settings/general' }]

const adminSettingsSections: NavigationItem[] = [
  { name: 'Casting', Icon: IconCast, href: '/settings/casting' },
  { name: 'Network access', Icon: IconNetwork, href: '/settings/firewall' },
  { name: 'Activity', Icon: IconHistory, href: '/settings/activity' },
  { name: 'System', Icon: IconServerSpark, href: '/settings/system' }
]

const userManagementSubSections: NavigationItem[] = [
  { name: 'Users', Icon: IconUsers, href: '/settings/users' },
  { name: 'Groups', Icon: IconShield, href: '/settings/groups' }
]

const orchestratorSubSections: NavigationItem[] = [
  { name: 'Overview', Icon: IconAdjustments, href: '/settings/orchestrator' },
  { name: 'Containers', Icon: IconBox, href: '/settings/orchestrator/containers' },
  { name: 'Images', Icon: IconBrandDocker, href: '/settings/orchestrator/images' },
  { name: 'Networks', Icon: IconNetwork, href: '/settings/orchestrator/networks' },
  { name: 'Metrics', Icon: IconChartHistogram, href: '/settings/orchestrator/metrics' }
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
      'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-input rounded-sm text-foreground dark:hover:text-white cursor-pointer',
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
  onStarted: () => void
}

const RecentAppLink = ({ app, variant, isActive, onNavigate, onStarted }: RecentAppLinkProps) => {
  const styles = variantStyles[variant]
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const isOperating = app.status === 'provisioning' || app.status === 'removing' || isStarting
  const canStart = app.status === 'stopped' || app.status === 'error'

  const startAndOpen = async () => {
    if (isStarting) return

    setIsStarting(true)
    router.push(`/app/${app.id}`)
    onNavigate?.()
    try {
      await startApplicationAction(app.id)
      onStarted()
    } catch {
      // The destination page surfaces the runtime error state after navigation.
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <li className={classNames(styles.item, 'group', isActive && styles.activeItem)}>
      <Link
        href={`/app/${app.id}`}
        onClick={onNavigate}
        className='flex min-w-0 flex-1 items-center gap-2'
      >
        <div className={styles.iconWrap}>
          <AppIcon
            appId={app.id}
            appName={app.name}
            icon={app.icon}
            className='size-6 text-[0.6rem]'
          />
        </div>
        <span className={classNames(styles.label, 'truncate')}>{app.name}</span>
      </Link>
      <Visible when={app.status === 'running'}>
        <span
          title='Running'
          aria-label='Running'
          className='mr-2 size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
        />
      </Visible>
      <Visible when={isOperating}>
        <IconLoader2
          title={app.statusLabel ?? 'Working'}
          aria-label={app.statusLabel ?? 'Working'}
          className='mr-1.5 size-4 shrink-0 animate-spin text-primary'
        />
      </Visible>
      <Visible when={canStart && !isStarting}>
        <button
          type='button'
          title={`Start ${app.name}`}
          aria-label={`Start ${app.name}`}
          className='mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-secondary-foreground opacity-0 transition hover:bg-primary/15 hover:text-primary focus:opacity-100 group-hover:opacity-100'
          onClick={() => void startAndOpen()}
        >
          <IconPlayerPlayFilled className='size-4' />
        </button>
      </Visible>
    </li>
  )
}

export const ProtectedNavigation = ({ variant, onNavigate }: ProtectedNavigationProps) => {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { data: recentApps = [], mutate: refreshRecentApps } = usePollingQuery<RecentApp[]>(
    'navigation:recent-apps',
    () => listRecentAppsAction(),
    { intervalMs: 5000 }
  )
  const isAdmin = session?.user.role === 'admin'
  const userManagementPathIsActive = pathname.startsWith('/settings/users')
  const orchestratorPathIsActive = pathname.startsWith('/settings/orchestrator')
  const [userManagementMenuIsOpen, setUserManagementMenuIsOpen] = useState(userManagementPathIsActive)
  const [orchestratorMenuIsOpen, setOrchestratorMenuIsOpen] = useState(orchestratorPathIsActive)
  const styles = variantStyles[variant]

  useEffect(() => {
    const onRecentAppsUpdated = () => void refreshRecentApps()

    window.addEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    return () => {
      window.removeEventListener(recentAppsUpdatedEvent, onRecentAppsUpdated)
    }
  }, [refreshRecentApps])

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
            onStarted={() => void refreshRecentApps()}
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
            <Visible when={userManagementMenuIsOpen}>
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
            </Visible>
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
            <Visible when={orchestratorMenuIsOpen}>
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
            </Visible>
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
