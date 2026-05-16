'use client'

import { IconAdjustments, IconApps, IconBrandDocker, IconLibraryPlus, IconServerSpark } from '@tabler/icons-react'
import { usePathname } from 'next/navigation'
import SidebarLink from '@/components/sidebar-link'

export default function Sidebar() {
  const pathname = usePathname()

  const appsSections = [
    { name: 'Installed Apps', Icon: IconApps, href: '/apps' },
    { name: 'Add New App', Icon: IconLibraryPlus, href: '/apps/create' }
  ]

  const settingsSections = [
    { name: 'General', Icon: IconAdjustments, href: '/settings/general' },
    { name: 'Orchestrator', Icon: IconBrandDocker, href: '/settings/orchestrator' },
    { name: 'System', Icon: IconServerSpark, href: '/settings/system' }
  ]

  return (
    <aside className='h-full w-72 flex flex-col overflow-auto pb-8 fixed left-0 top-16 max-lg:hidden'>
      <div className='w-full py-6 flex flex-col px-2'>
        <h6 className='text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm'>Apps</h6>
        <ul className='w-full pb-6 flex flex-col'>
          {appsSections.map(({ name, Icon, href }) => (
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
