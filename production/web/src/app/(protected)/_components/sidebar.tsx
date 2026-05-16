'use client'

import { useEffect, useState } from 'react'
import {
  IconAdjustments,
  IconApps,
  IconBrandDocker,
  IconLibraryPlus,
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

  const appsSections = [
    { name: 'Installed Apps', Icon: IconApps, href: '/apps' },
    { name: 'Add New App', Icon: IconLibraryPlus, href: '/apps/create' }
  ]

  const settingsSections = [
    { name: 'General', Icon: IconAdjustments, href: '/settings/general' },
    ...(isAdmin
      ? [
          { name: 'Users', Icon: IconUsers, href: '/settings/users' },
          { name: 'Orchestrator', Icon: IconBrandDocker, href: '/settings/orchestrator' },
          { name: 'System', Icon: IconServerSpark, href: '/settings/system' }
        ]
      : [])
  ]

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
              isActive={pathname === href}
            />
          ))}
        </ul>
      </div>
    </aside>
  )
}
