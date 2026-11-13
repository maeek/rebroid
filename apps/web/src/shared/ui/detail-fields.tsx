'use client'

import { useTransition, type ReactNode } from 'react'
import { IconCopy } from '@tabler/icons-react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export type DetailField = {
  label: string
  value: ReactNode
  copyValue?: string
  code?: boolean
  fullWidth?: boolean
}

const CopyDiagnosticValue = ({ label, value }: { label: string; value: string }) => {
  const [pending, startTransition] = useTransition()
  return (
    <MutationButton
      type='button'
      variant='ghost'
      size='icon-sm'
      className='size-6 shrink-0 text-foreground-muted opacity-0 transition-opacity group-hover/detail:opacity-100 group-focus-within/detail:opacity-100 [@media(hover:none)]:opacity-100'
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      pending={pending}
      pendingLabel={<span className='sr-only'>Copying…</span>}
      onClick={() =>
        startTransition(async () => {
          try {
            await navigator.clipboard.writeText(value)
            toast({ title: `${label} copied`, variant: 'success' })
          } catch {
            toast({ title: 'Could not copy value', variant: 'danger' })
          }
        })
      }
    >
      <IconCopy className='size-3.5' />
    </MutationButton>
  )
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
    <dl className={cn('grid min-w-0 gap-x-6', layout === 'grid' && 'sm:grid-cols-2', compact ? 'gap-y-2' : 'gap-y-4')}>
      {fields.map(field => (
        <div
          key={field.label}
          className={cn(
            'group/detail min-w-0',
            layout === 'list' ? 'flex items-center gap-3' : 'grid content-start gap-1',
            layout === 'grid' && field.fullWidth && 'sm:col-span-2'
          )}
        >
          <dt
            className={cn(
              'flex min-h-6 min-w-0 items-center gap-1 font-medium [overflow-wrap:anywhere]',
              layout === 'list' ? 'text-sm/6 touch:text-base/6' : 'text-xs text-foreground-muted touch:text-sm/5'
            )}
          >
            {loading ? <Skeleton className='h-3 w-24' /> : <span>{field.label}</span>}
            {!loading && field.copyValue ? (
              <CopyDiagnosticValue
                label={field.label}
                value={field.copyValue}
              />
            ) : null}
          </dt>
          <dd
            className={cn(
              'min-w-0 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] touch:text-base/6',
              layout === 'list' && 'text-foreground-muted tabular-nums',
              field.code && 'font-mono'
            )}
          >
            {loading ? (
              <Skeleton className={cn('my-1 h-4', layout === 'list' ? 'w-12' : 'w-3/4')} />
            ) : (
              (field.value ?? 'Not available')
            )}
          </dd>
        </div>
      ))}
    </dl>
  </Section>
)
