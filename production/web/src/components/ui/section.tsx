'use client'
import { ReactNode, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export const Section = ({
  className,
  children,
  title,
  orientation = 'vertical',
  collapsible,
  contentClassName,
  boxed
}: {
  className?: string
  children?: ReactNode
  title?: ReactNode
  orientation?: 'horizontal' | 'vertical'
  collapsible?: boolean
  contentClassName?: string
  boxed?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const boxedCollapsible = Boolean(boxed && collapsible)
  const content = (
    <div
      className={cn('flex', contentClassName, {
        'flex-col': orientation === 'vertical'
      })}
    >
      {children}
    </div>
  )

  return (
    <div
      className={cn(
        'flex flex-col w-full rounded-lg',
        boxed &&
          'border border-border/70 bg-card/55 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md max-sm:p-4',
        boxedCollapsible && 'p-0',
        className
      )}
    >
      {title && (
        <div
          className={cn(
            'flex items-center justify-between pb-4',
            collapsible && 'cursor-pointer',
            boxedCollapsible && 'px-6 py-5 pb-5 max-sm:px-4 max-sm:py-4 max-sm:pb-4'
          )}
          onClick={() => collapsible && setIsOpen(p => !p)}
        >
          <h3 className='font-medium'>{title}</h3>
          {collapsible && (
            <IconChevronDown className={cn('cursor-pointer transition hover:text-primary', isOpen && '-rotate-180')} />
          )}
        </div>
      )}

      {title && collapsible ? (
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out',
            boxedCollapsible && 'px-6 max-sm:px-4',
            isOpen
              ? cn('grid-rows-[1fr] opacity-100 pt-2', boxedCollapsible && 'pb-6 max-sm:pb-4')
              : 'grid-rows-[0fr] opacity-0 pt-0 pb-0'
          )}
        >
          <div className='min-h-0'>{content}</div>
        </div>
      ) : (
        content
      )}
    </div>
  )
}
