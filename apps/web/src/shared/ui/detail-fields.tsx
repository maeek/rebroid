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
              <CopyDiagnosticValue
                label={field.label}
                value={field.copyValue}
              />
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
