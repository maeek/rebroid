'use client'
import { ReactNode, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { bandSurfaceClassName, panelSurfaceClassName } from '@/components/ui/surface'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

export type SectionSurface = 'plain' | 'band' | 'panel'
export type SectionHeadingSpacing = 'none' | 'compact' | 'default'

interface SectionProps {
  actions?: ReactNode
  children?: ReactNode
  className?: string
  collapsible?: boolean
  contentClassName?: string
  defaultOpen?: boolean
  description?: ReactNode
  headingLevel?: 2 | 3
  headingSpacing?: SectionHeadingSpacing
  orientation?: 'horizontal' | 'vertical'
  surface: SectionSurface
  title?: ReactNode
  titleClassName?: string
}

export const Section = ({
  className,
  children,
  title,
  orientation = 'vertical',
  collapsible,
  contentClassName,
  defaultOpen = false,
  description,
  headingLevel = 2,
  headingSpacing = 'default',
  actions,
  titleClassName,
  surface
}: SectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const panelCollapsible = surface === 'panel' && Boolean(collapsible)
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
      data-surface={surface}
      className={cn(
        'flex flex-col w-full rounded-panel',
        {
          [cn(bandSurfaceClassName, 'p-6 max-sm:p-4')]: surface === 'band',
          [cn(panelSurfaceClassName, 'p-6 max-sm:p-4')]: surface === 'panel',
          'p-0': panelCollapsible
        },
        className
      )}
    >
      <Visible when={title}>
        {collapsible ? (
          <button
            type='button'
            aria-expanded={isOpen}
            className={cn(
              'flex w-full items-center justify-between text-left',
              { 'px-6 py-5 max-sm:px-4 max-sm:py-4': panelCollapsible },
              titleClassName
            )}
            onClick={() => setIsOpen(open => !open)}
          >
            <span className='grid gap-1'>
              <Heading className='font-medium'>{title}</Heading>
              <Visible when={description}>
                <span className='text-sm font-normal text-foreground-muted'>{description}</span>
              </Visible>
            </span>
            <IconChevronDown
              className={cn('transition', {
                '-rotate-180': isOpen
              })}
            />
          </button>
        ) : (
          <div
            data-testid='section-heading'
            data-heading-spacing={headingSpacing}
            className={cn(
              'flex items-start justify-between gap-4',
              {
                'pb-0': headingSpacing === 'none',
                'pb-2': headingSpacing === 'compact',
                'pb-4': headingSpacing === 'default'
              },
              titleClassName
            )}
          >
            <div className='grid gap-1'>
              <Heading className='font-medium'>{title}</Heading>
              <Visible when={description}>
                <p className='text-sm text-foreground-muted'>{description}</p>
              </Visible>
            </div>
            <Visible when={actions}>
              <div className='flex shrink-0 items-center gap-2'>{actions}</div>
            </Visible>
          </div>
        )}
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
