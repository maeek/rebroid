import { Fragment, ReactNode } from 'react'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export type PageBreadcrumbItem = {
  label: ReactNode
  badge?: ReactNode
  href?: string
}

export const PageBreadcrumbs = ({ items, className }: { items: PageBreadcrumbItem[]; className?: string }) => {
  if (items.length === 0) {
    return null
  }

  return (
    <Breadcrumb className={cn('w-full pt-2', className)}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <Fragment key={index}>
              <BreadcrumbItem className='min-w-0 max-w-full [overflow-wrap:anywhere]'>
                <Visible when={isLast}>
                  <BreadcrumbPage>
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                      {item.label}
                      {item.badge}
                    </div>
                  </BreadcrumbPage>
                </Visible>
                {!isLast && item.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : null}
                {!isLast && !item.href ? <span>{item.label}</span> : null}
              </BreadcrumbItem>
              <Visible when={!isLast}>
                <BreadcrumbSeparator className='shrink-0' />
              </Visible>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
