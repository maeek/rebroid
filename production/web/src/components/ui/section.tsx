'use client'
import { ReactNode, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export const Section = ({
  className,
  children,
  title,
  orientation = 'vertical',
  collapsible,
  contentClassName,
  titleClassName,
  boxed
}: {
  className?: string
  children?: ReactNode
  title?: ReactNode
  orientation?: 'horizontal' | 'vertical'
  collapsible?: boolean
  titleClassName?: string
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
        {
          'border border-border/70 bg-card/55 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md max-sm:p-4':
            boxed,
          'p-0': boxedCollapsible
        },
        className
      )}
    >
      <Visible when={title}>
        <div
          className={cn(
            'flex items-center justify-between',
            {
              'cursor-pointer': collapsible,
              'px-6 py-5 pb-5 max-sm:px-4 max-sm:py-4 max-sm:pb-4': boxedCollapsible
            },
            titleClassName
          )}
          onClick={() => collapsible && setIsOpen(p => !p)}
        >
          <h3 className='font-medium'>{title}</h3>
          <Visible when={collapsible}>
            <IconChevronDown
              className={cn('cursor-pointer transition hover:text-primary', {
                '-rotate-180': isOpen
              })}
            />
          </Visible>
        </div>
      </Visible>

      {title && collapsible ? (
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out',
            {
              'px-6 max-sm:px-4': boxedCollapsible,
              'grid-rows-[1fr] opacity-100 pt-2': isOpen,
              'pb-6 max-sm:pb-4': isOpen && boxedCollapsible,
              'grid-rows-[0fr] opacity-0 pt-0 pb-0': !isOpen
            }
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
