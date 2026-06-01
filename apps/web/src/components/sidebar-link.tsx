'use client'

import { type ElementType } from 'react'
import classNames from 'classnames'
import Link from 'next/link'

type SidebarLinkProps = {
  href: string
  label: string
  Icon: ElementType<{ className?: string }>
  isActive?: boolean
}

export default function SidebarLink({ href, label, Icon, isActive = false }: SidebarLinkProps) {
  return (
    <Link href={href}>
      <li
        className={classNames(
          'flex gap-2 justify-start items-center px-2 py-1 max-lg:py-2 hover:bg-white/5 rounded-sm text-foreground dark:hover:text-white cursor-pointer',
          { 'bg-white/5 text-primary!': isActive }
        )}
      >
        <div className='size-8 rounded-sm flex justify-center items-center'>
          <Icon className='size-5 max-lg:size-5 stroke-current' />
        </div>
        <span className='text-sm max-lg:text-inherit'>{label}</span>
      </li>
    </Link>
  )
}
