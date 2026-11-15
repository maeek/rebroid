'use client'

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode, type ComponentProps } from 'react'
import { IconDots, IconHome } from '@tabler/icons-react'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type PageBreadcrumbItem = {
  label: ReactNode
  badge?: ReactNode
  href?: string
}

// Extend the hit area into the gutter while keeping the icon on the content edge.
export const pageBackButtonClassName =
  '-ms-3.5 h-(--page-header-control-size) w-11 min-w-11 justify-start gap-4 border-0 ps-3.5'

export const PageBreadcrumbRow = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    {...props}
    className={cn('flex min-h-(--page-header-control-size) min-w-0 items-start gap-2', className)}
  />
)

const homeHref = '/apps'

export const PageHomeLink = ({ className }: { className?: string }) => (
  <Button
    asChild
    variant='ghost'
    size='icon-md'
    className={cn(pageBackButtonClassName, 'text-foreground-muted', className)}
  >
    <Link
      href={homeHref}
      aria-label='Home'
    >
      <IconHome aria-hidden='true' />
    </Link>
  </Button>
)

export const PageBreadcrumbs = ({ items, className }: { items: PageBreadcrumbItem[]; className?: string }) => {
  const trailRef = useRef<HTMLOListElement>(null)
  const sizesRef = useRef<HTMLOListElement>(null)
  const [collapsedCount, setCollapsedCount] = useState<number>()
  const ancestors = items
    .slice(0, -1)
    .filter((item): item is PageBreadcrumbItem & { href: string } => Boolean(item.href && item.href !== homeHref))
  const ancestorCount = ancestors.length
  const earlierLinks = ancestors.slice(0, collapsedCount ?? ancestorCount)
  const showInlineAncestors = earlierLinks.length < ancestorCount
  const current = items.at(-1)

  useLayoutEffect(() => {
    const trail = trailRef.current
    const sizes = sizesRef.current
    if (!trail || !sizes) return

    const measure = () => {
      const available = trail.getBoundingClientRect().width
      if (available === 0 || sizes.getBoundingClientRect().width === 0) return

      const gap = Number.parseFloat(getComputedStyle(sizes).columnGap)
      const [homeWidth, chevronWidth, overflowWidth, currentWidth, minimumLinkWidth, ...linkWidths] = Array.from(
        sizes.children,
        item => item.getBoundingClientRect().width
      )
      const separatorSpace = chevronWidth + 2 * gap
      let required = homeWidth + separatorSpace + currentWidth
      for (const linkWidth of linkWidths) required += linkWidth + separatorSpace
      if (required <= available) {
        setCollapsedCount(0)
        return
      }

      const overflowSpace = overflowWidth + separatorSpace
      required += overflowSpace
      for (let collapsed = 1; collapsed < ancestorCount; collapsed++) {
        required -= linkWidths[collapsed - 1] + separatorSpace
        if (required <= available) {
          setCollapsedCount(collapsed)
          return
        }
      }

      // Give the last page its full width before allowing a shortened parent link.
      const parentWidth = linkWidths[ancestorCount - 1]
      const parentSpace = available - (required - parentWidth) + (ancestorCount === 1 ? overflowSpace : 0)
      setCollapsedCount(parentSpace >= Math.min(parentWidth, minimumLinkWidth) ? ancestorCount - 1 : ancestorCount)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(trail)
    observer.observe(sizes)
    // Individual labels can change width even if the whole trail stays the same size.
    for (const item of sizes.children) observer.observe(item)
    return () => observer.disconnect()
  }, [ancestorCount])

  if (!current) return null

  return (
    <Breadcrumb className={cn('relative w-full lg:mt-[calc((var(--page-header-control-size)-1.25rem)/2)]', className)}>
      <BreadcrumbList
        ref={trailRef}
        className='items-start leading-5 max-lg:min-h-(--page-header-control-size) max-lg:flex-nowrap max-lg:items-center'
      >
        <BreadcrumbItem className='shrink-0 lg:hidden'>
          <PageHomeLink className='-me-3.5' />
        </BreadcrumbItem>
        <BreadcrumbSeparator className='flex h-5 shrink-0 items-center lg:hidden' />
        {earlierLinks.length > 0 ? (
          <>
            <BreadcrumbItem className='shrink-0 lg:hidden'>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-md'
                    aria-label='Earlier pages'
                    className='-mx-2 size-11 text-foreground-muted'
                  >
                    <IconDots aria-hidden='true' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  aria-label='Earlier pages'
                  className='scrollbar-thin max-h-(--available-height) max-w-[calc(100vw-2rem)] overflow-y-auto lg:hidden'
                >
                  {earlierLinks.map(({ label, href }) => (
                    <DropdownMenuItem
                      key={href}
                      asChild
                      className='min-h-11 [overflow-wrap:anywhere]'
                    >
                      <Link href={href}>{label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator className='flex h-5 shrink-0 items-center lg:hidden' />
          </>
        ) : null}
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const hideOnMobile =
            !isLast && (!item.href || item.href === homeHref || earlierLinks.some(link => link === item))
          const title = typeof item.label === 'string' ? item.label : undefined

          return (
            <Fragment key={index}>
              <BreadcrumbItem
                className={cn(
                  'min-w-0 max-w-full [overflow-wrap:anywhere]',
                  isLast && showInlineAncestors && 'max-lg:shrink-0',
                  hideOnMobile && 'max-lg:hidden'
                )}
              >
                {isLast ? (
                  <BreadcrumbPage
                    className='flex min-w-0 flex-wrap items-center gap-2 max-lg:block max-lg:truncate'
                    title={title}
                  >
                    {item.label}
                    {item.badge}
                  </BreadcrumbPage>
                ) : item.href ? (
                  <BreadcrumbLink asChild>
                    <Link
                      href={item.href}
                      title={title}
                      className='max-lg:flex max-lg:h-11 max-lg:max-w-full max-lg:items-center max-lg:rounded-control focus-visible:outline-2 focus-visible:outline-ring'
                    >
                      <span className='max-lg:truncate'>{item.label}</span>
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span
                    className='max-lg:truncate'
                    title={title}
                  >
                    {item.label}
                  </span>
                )}
              </BreadcrumbItem>
              {!isLast ? (
                <BreadcrumbSeparator
                  className={cn('flex h-5 shrink-0 items-center', hideOnMobile && 'max-lg:hidden')}
                />
              ) : null}
            </Fragment>
          )
        })}
      </BreadcrumbList>
      {ancestorCount > 0 ? (
        <div
          aria-hidden='true'
          inert
          className='invisible pointer-events-none absolute start-0 top-0 size-0 overflow-hidden lg:hidden'
        >
          <BreadcrumbList
            ref={sizesRef}
            className='w-max flex-nowrap leading-5 whitespace-nowrap'
          >
            {/* Measure the controls' occupied width after their hit areas extend into the gaps. */}
            <BreadcrumbItem className='w-4' />
            <BreadcrumbSeparator />
            <BreadcrumbItem className='w-7' />
            <BreadcrumbItem>{current.label}</BreadcrumbItem>
            <BreadcrumbItem className='w-20' />
            {ancestors.map(({ label }, index) => (
              <BreadcrumbItem key={index}>{label}</BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </div>
      ) : null}
    </Breadcrumb>
  )
}
