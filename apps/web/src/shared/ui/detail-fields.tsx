'use client'

import type { ReactNode } from 'react'
import { CopyButton } from '@/components/ui/copy-button'
import { RowActions } from '@/components/ui/row-actions'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type DetailField = {
  label: string
  value: ReactNode
  copyValue?: string
  code?: boolean
  fullWidth?: boolean
}

export const DetailFields = ({
  title,
  fields,
  loading = false,
  compact = false,
  layout = 'grid'
}: {
  title?: string
  fields: DetailField[]
  loading?: boolean
  compact?: boolean
  layout?: 'grid' | 'list'
}) => (
  <Section
    surface='plain'
    title={title}
    headingLevel={3}
    headingSpacing='compact'
  >
    <dl
      className={cn(
        'grid min-w-0',
        layout === 'list'
          ? 'w-fit max-w-full grid-cols-[minmax(0,max-content)_minmax(0,max-content)] gap-x-4 font-mono text-xs/5 touch:text-sm/5'
          : 'gap-x-6 sm:grid-cols-2',
        compact ? 'gap-y-2' : 'gap-y-4',
        compact && layout === 'list' && 'gap-y-0.5'
      )}
    >
      {fields.map(field => (
        <div
          key={field.label}
          data-row-actions-scope
          className={cn(
            'group/detail min-w-0',
            layout === 'list' ? 'col-span-2 grid grid-cols-subgrid items-center' : 'grid content-start gap-1',
            layout === 'grid' && field.fullWidth && 'sm:col-span-2'
          )}
        >
          <dt
            className={cn(
              'flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]',
              layout === 'list' ? 'min-h-5' : 'min-h-6 text-xs font-medium text-foreground-muted touch:text-sm/5'
            )}
          >
            {loading ? <Skeleton className='h-3 w-24' /> : <span>{field.label}</span>}
            {!loading && field.copyValue ? (
              <RowActions>
                <CopyButton
                  iconOnly
                  aria-label={`Copy ${field.label}`}
                  value={field.copyValue}
                  className='size-6 text-foreground-muted [&_svg]:size-3.5'
                />
              </RowActions>
            ) : null}
          </dt>
          <dd
            className={cn(
              'min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]',
              layout === 'list' ? 'text-right text-foreground-muted' : 'text-sm leading-6 touch:text-base/6',
              field.code && 'font-mono'
            )}
          >
            {loading ? (
              <Skeleton className={cn(layout === 'list' ? 'ml-auto h-3 w-12' : 'my-1 h-4 w-3/4')} />
            ) : (
              (field.value ?? 'Not available')
            )}
          </dd>
        </div>
      ))}
    </dl>
  </Section>
)
