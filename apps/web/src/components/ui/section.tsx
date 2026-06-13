'use client'
import { ReactNode, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { bandSurfaceClassName, panelSurfaceClassName } from '@/components/ui/surface-classes'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

type SectionSurface = 'plain' | 'band' | 'panel'

export const Section = ({
  className,
  children,
  title,
  orientation = 'vertical',
  collapsible,
  contentClassName,
  titleClassName,
  boxed,
  surface
}: {
  className?: string
  children?: ReactNode
  title?: ReactNode
  orientation?: 'horizontal' | 'vertical'
  collapsible?: boolean
  titleClassName?: string
  contentClassName?: string
  boxed?: boolean
  surface?: SectionSurface
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const resolvedSurface = surface ?? (boxed ? 'panel' : 'plain')
  const panelCollapsible = resolvedSurface === 'panel' && Boolean(collapsible)
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
    <section
      aria-label={typeof title === 'string' ? title : undefined}
      data-slot='section'
      data-surface={resolvedSurface}
      className={cn(
        'flex flex-col w-full rounded-xl',
        {
          [cn(bandSurfaceClassName, 'p-6 max-sm:p-4')]: resolvedSurface === 'band',
          [cn(panelSurfaceClassName, 'p-6 max-sm:p-4')]: resolvedSurface === 'panel',
          'p-0': panelCollapsible
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
              'px-6 py-5 pb-5 max-sm:px-4 max-sm:py-4 max-sm:pb-4': panelCollapsible
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

      <Visible when={title && collapsible}>
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,opacity,padding-top,padding-bottom] duration-200 ease-out',
            {
              'px-6 max-sm:px-4': panelCollapsible,
              'grid-rows-[1fr] opacity-100 pt-2': isOpen,
              'pb-6 max-sm:pb-4': isOpen && panelCollapsible,
              'grid-rows-[0fr] opacity-0 pt-0 pb-0': !isOpen
            }
          )}
        >
          <div className='min-h-0'>{content}</div>
        </div>
      </Visible>
      <Visible when={!(title && collapsible)}>{content}</Visible>
    </section>
  )
}
