'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  resourceNavigationActiveClassName,
  resourceNavigationItemClassName,
  resourceNavigationInteractiveClassName,
  resourceNavigationListClassName
} from './resource-navigation-style'

type ResourceNavigationItem = {
  id: string
  label: string
  icon?: ReactNode
  href?: string
  current?: boolean
}

export const ResourceNavigation = ({
  label,
  items,
  preserveScroll = false
}: {
  label: string
  items: ResourceNavigationItem[]
  preserveScroll?: boolean
}) => {
  const selected = useRef<HTMLAnchorElement>(null)
  const currentId = items.find(item => item.current)?.id
  useEffect(() => {
    const item = selected.current
    if (!preserveScroll) {
      item?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      return
    }

    const navigation = item?.parentElement
    if (!item || !navigation || navigation.scrollWidth <= navigation.clientWidth) return

    const itemBounds = item.getBoundingClientRect()
    const navigationBounds = navigation.getBoundingClientRect()
    if (itemBounds.left < navigationBounds.left) navigation.scrollLeft += itemBounds.left - navigationBounds.left
    if (itemBounds.right > navigationBounds.right) navigation.scrollLeft += itemBounds.right - navigationBounds.right
  }, [currentId, preserveScroll])

  return (
    <nav
      aria-label={label}
      className={resourceNavigationListClassName}
    >
      {items.map(item => {
        const className = cn(
          resourceNavigationItemClassName,
          item.icon && 'inline-flex items-center gap-1.5',
          item.current && resourceNavigationActiveClassName
        )
        const content = (
          <>
            {item.icon && (
              <span
                aria-hidden='true'
                className='shrink-0'
              >
                {item.icon}
              </span>
            )}
            {item.label}
          </>
        )

        return item.href ? (
          <Link
            key={item.id}
            href={item.href}
            scroll={!preserveScroll}
            aria-current={item.current ? 'page' : undefined}
            ref={item.current ? selected : undefined}
            className={cn(className, resourceNavigationInteractiveClassName)}
          >
            {content}
          </Link>
        ) : (
          <span
            key={item.id}
            aria-current={item.current ? 'page' : undefined}
            className={className}
          >
            {content}
          </span>
        )
      })}
    </nav>
  )
}
