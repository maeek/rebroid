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
  return (
    <div
      className={cn(
        'flex flex-col w-full rounded-lg py-4',
        boxed && 'bg-card/60 p-6 max-sm:p-4 hover:bg-card/50 border border-input',
        className
      )}
    >
      {title && (
        <div
          className='flex justify-between items-center pb-2'
          onClick={() => collapsible && setIsOpen(p => !p)}
        >
          <h3 className='font-medium'>{title}</h3>
          {collapsible && <IconChevronDown className={cn('cursor-pointer transition', isOpen && '-rotate-180')} />}
        </div>
      )}
      {(!title || isOpen || !collapsible) && (
        <div
          className={cn('flex', contentClassName, {
            'pt-2': isOpen,
            'flex-col': orientation === 'vertical'
          })}
        >
          {children}
        </div>
      )}
    </div>
  )
}
