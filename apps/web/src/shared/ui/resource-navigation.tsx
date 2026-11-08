'use client'

import { useEffect, useRef } from 'react'
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
  href?: string
  current?: boolean
}

export const ResourceNavigation = ({ label, items }: { label: string; items: ResourceNavigationItem[] }) => {
  const selected = useRef<HTMLAnchorElement>(null)
  const currentId = items.find(item => item.current)?.id
  useEffect(() => {
    selected.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [currentId])

  return (
    <nav
      aria-label={label}
      className={resourceNavigationListClassName}
    >
      {items.map(item =>
        item.href ? (
          <Link
            key={item.id}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            ref={item.current ? selected : undefined}
            className={cn(
              resourceNavigationItemClassName,
              resourceNavigationInteractiveClassName,
              item.current && resourceNavigationActiveClassName
            )}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.id}
            aria-current={item.current ? 'page' : undefined}
            className={cn(resourceNavigationItemClassName, item.current && resourceNavigationActiveClassName)}
          >
            {item.label}
          </span>
        )
      )}
    </nav>
  )
}
