'use client'

import {
  IconAdjustments,
  IconApps,
  IconBrandAndroid,
  IconLibraryPlusFilled,
  IconServerSpark
} from '@tabler/icons-react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar({
  forceMobile,
  closeNodeSlot,
  onLinkChange
}: {
  forceMobile?: boolean
  closeNodeSlot?: React.ReactNode
  onLinkChange?: (href: string) => void
}) {
  const pathname = usePathname()

  const appsSections = [
    { name: 'Installed Apps', Icon: IconApps, href: '/apps' },
    { name: 'Add New App', Icon: IconLibraryPlusFilled, href: '/apps/create' }
  ]

  const settingsSections = [
    { name: 'General', Icon: IconAdjustments },
    { name: 'Redroid', Icon: IconBrandAndroid, href: '/redroid' },
    { name: 'System', Icon: IconServerSpark, href: '/settings/system' }
  ]

  if (pathname === '/editor') return null

  return (
    <aside
      className={`h-full w-72 flex flex-col overflow-auto pb-8 fixed left-0 top-16 ${forceMobile ? 'max-lg:top-0 max-lg:relative max-lg:w-full max-lg:border-0' : 'max-lg:hidden'}`}
    >
      {closeNodeSlot}
      <div className='w-full py-6 flex flex-col px-2'>
        <h6 className='text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm'>Apps</h6>
        <ul className='w-full pb-6 flex flex-col'>
          {appsSections.map(({ name, Icon, href }) => (
            <Link
              key={name}
              href={href || '/'}
              onClick={() => onLinkChange?.(href || '')}
            >
              <li
                className={classNames(
                  'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-input rounded-sm text-foreground dark:hover:text-white cursor-pointer',
                  { 'bg-input': pathname === href }
                )}
              >
                <div className='w-8 h-8 rounded-sm flex justify-center items-center'>
                  <Icon className='w-5 h-5 max-lg:w-5 max-lg:h-5 stroke-current' />
                </div>
                <span className='text-base max-lg:text-inherit text-inherit'>{name}</span>
              </li>
            </Link>
          ))}
        </ul>
        <h6 className='text-sm pb-4 font-semibold color-secondary px-2 max-lg:text-sm'>Settings</h6>
        <ul className='w-full pb-6 flex flex-col'>
          {settingsSections.map(({ name, Icon, href }) => (
            <Link
              key={name}
              href={href || '/'}
              onClick={() => onLinkChange?.(href || '')}
            >
              <li
                className={classNames(
                  'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-input rounded-sm text-foreground dark:hover:text-white cursor-pointer',
                  { 'bg-input': pathname === href }
                )}
              >
                <div className='w-8 h-8 rounded-sm flex justify-center items-center'>
                  <Icon className='w-5 h-5 max-lg:w-5 max-lg:h-5 stroke-current' />
                </div>
                <span className='text-base max-lg:text-inherit text-inherit'>{name}</span>
              </li>
            </Link>
          ))}
        </ul>
      </div>
    </aside>
  )
}
