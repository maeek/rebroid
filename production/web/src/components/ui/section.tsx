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
        boxed && 'bg-card/60 p-6 max-sm:p-4 hover:bg-card/50 border border-input',
        className
      )}
    >
      {title && (
        <div
          className={cn('flex justify-between items-center pb-4', collapsible && 'cursor-pointer')}
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
            'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top] duration-200 ease-out',
            isOpen ? 'grid-rows-[1fr] opacity-100 pt-2' : 'grid-rows-[0fr] opacity-0 pt-0'
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
