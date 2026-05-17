'use client'

import { useEffect, useState } from 'react'
import {
  IconAdjustments,
  IconApps,
  IconBox,
  IconBrandDocker,
  IconChevronDown,
  IconLibraryPlus,
  IconNetwork,
  IconServerSpark,
  IconUsers
} from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AppIcon } from '@/app/(protected)/_components/apps/app-icon'
import SidebarLink from '@/components/sidebar-link'
import { getAppIconsAction } from '@/lib/app-icons/actions'
import { readRecentApps, recentAppsStorageKey, recentAppsUpdatedEvent, type RecentApp } from '@/lib/recent-apps'

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const isAdmin = session?.user.role === 'admin'
  const orchestratorPathIsActive = pathname.startsWith('/settings/orchestrator')
  const [orchestratorMenuIsOpen, setOrchestratorMenuIsOpen] = useState(orchestratorPathIsActive)

  useEffect(() => {
    const hydrateRecentApps = async (apps: RecentApp[]) => {
      setRecentApps(apps)
      const appsMissingIcons = apps.filter(app => !app.icon)
      if (appsMissingIcons.length === 0) {
        return
      }

      try {
        const icons = await getAppIconsAction(appsMissingIcons.map(app => app.id))
        const hydratedApps = apps.map(app => ({ ...app, icon: app.icon ?? icons[app.id] ?? null }))
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
    if (orchestratorPathIsActive) {
      setOrchestratorMenuIsOpen(true)
    }
  }, [orchestratorPathIsActive])

  const appsSections = [
    { name: 'Installed Apps', Icon: IconApps, href: '/apps' },
    { name: 'Add New App', Icon: IconLibraryPlus, href: '/apps/create' }
  ]

  const settingsSections = [{ name: 'General', Icon: IconAdjustments, href: '/settings/general' }]

  const adminSettingsSections = [
    { name: 'Users', Icon: IconUsers, href: '/settings/users' },
    { name: 'System', Icon: IconServerSpark, href: '/settings/system' }
  ]

  const orchestratorSubSections = [
    { name: 'Containers', Icon: IconBox, href: '/settings/orchestrator/containers' },
    { name: 'Images', Icon: IconBrandDocker, href: '/settings/orchestrator/images' },
    { name: 'Networks', Icon: IconNetwork, href: '/settings/orchestrator/networks' }
  ]

  const isActivePath = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside className='h-full w-72 flex flex-col overflow-auto pb-8 fixed left-0 top-16 max-lg:hidden'>
      <div className='w-full py-6 flex flex-col px-2'>
        <h6 className='text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm'>Apps</h6>
        <ul className='w-full pb-6 flex flex-col'>
          {appsSections.slice(0, 1).map(({ name, Icon, href }) => (
            <SidebarLink
              key={name}
              href={href || '/'}
              label={name}
              Icon={Icon}
              isActive={pathname === href}
            />
          ))}
          {recentApps.map(app => (
            <Link
              key={app.id}
              href={`/app/${app.id}`}
            >
              <li
                className={classNames(
                  'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-white/5 rounded-sm text-foreground dark:hover:text-white cursor-pointer',
                  { 'bg-white/5 text-primary!': pathname === `/app/${app.id}` }
                )}
              >
                <div className='size-8 flex shrink-0 items-center justify-center'>
                  <AppIcon
                    appId={app.id}
                    appName={app.name}
                    icon={app.icon}
                    className='size-6 text-[0.6rem]'
                  />
                </div>
                <span className='truncate text-sm max-lg:text-inherit'>{app.name}</span>
              </li>
            </Link>
          ))}
          {appsSections.slice(1).map(({ name, Icon, href }) => (
            <SidebarLink
              key={name}
              href={href || '/'}
              label={name}
              Icon={Icon}
              isActive={pathname === href}
            />
          ))}
        </ul>
        <h6 className='text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm'>Settings</h6>
        <ul className='w-full pb-6 flex flex-col'>
          {settingsSections.map(({ name, Icon, href }) => (
            <SidebarLink
              key={name}
              href={href || '/'}
              label={name}
              Icon={Icon}
              isActive={isActivePath(href)}
            />
          ))}
          {isAdmin && (
            <>
              {adminSettingsSections.slice(0, 1).map(({ name, Icon, href }) => (
                <SidebarLink
                  key={name}
                  href={href}
                  label={name}
                  Icon={Icon}
                  isActive={isActivePath(href)}
                />
              ))}
              <li>
                <div
                  className={classNames(
                    'flex items-center rounded-sm text-foreground dark:hover:text-white',
                    pathname === '/settings/orchestrator' && 'bg-white/5 text-primary!'
                  )}
                >
                  <Link
                    href='/settings/orchestrator'
                    className='flex min-w-0 flex-1 items-center gap-2 px-2 py-1 hover:bg-white/5'
                  >
                    <div className='size-8 rounded-sm flex justify-center items-center'>
                      <IconBrandDocker className='size-5 max-lg:size-5 stroke-current' />
                    </div>
                    <span className='truncate text-sm max-lg:text-inherit'>Orchestrator</span>
                  </Link>
                  <button
                    type='button'
                    className='mr-1 flex size-8 items-center justify-center rounded-sm text-secondary-foreground transition hover:bg-white/5 hover:text-foreground'
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
                  <ul className='min-h-0 space-y-1 py-1 pl-8'>
                    {orchestratorSubSections.map(({ name, Icon, href }) => (
                      <Link
                        key={href}
                        href={href}
                      >
                        <li
                          className={classNames(
                            'flex items-center gap-2 rounded-sm px-2 py-1 text-sm text-secondary-foreground transition hover:bg-white/5 hover:text-foreground',
                            isActivePath(href) && 'bg-white/5 text-primary!'
                          )}
                        >
                          <div className='flex size-7 shrink-0 items-center justify-center rounded-sm'>
                            <Icon className='size-4 stroke-current' />
                          </div>
                          <span className='truncate'>{name}</span>
                        </li>
                      </Link>
                    ))}
                  </ul>
                </div>
              </li>
              {adminSettingsSections.slice(1).map(({ name, Icon, href }) => (
                <SidebarLink
                  key={name}
                  href={href}
                  label={name}
                  Icon={Icon}
                  isActive={isActivePath(href)}
                />
              ))}
            </>
          )}
        </ul>
      </div>
    </aside>
  )
}
