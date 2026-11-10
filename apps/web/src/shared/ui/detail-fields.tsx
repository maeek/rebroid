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
  loading = false
}: {
  title?: string
  fields: DetailField[]
  loading?: boolean
}) => (
  <Section
    surface='plain'
    title={title}
    headingLevel={3}
    headingSpacing='compact'
  >
    <dl className='grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2'>
      {fields.map(field => (
        <div
          key={field.label}
          className={cn('group/detail grid min-w-0 content-start gap-1', field.fullWidth && 'sm:col-span-2')}
        >
          <dt className='flex min-h-6 items-center gap-1 text-xs font-medium text-foreground-muted touch:text-sm/5'>
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
              field.code && 'font-mono'
            )}
          >
            {loading ? <Skeleton className='my-1 h-4 w-3/4' /> : (field.value ?? 'Not available')}
          </dd>
        </div>
      ))}
    </dl>
  </Section>
)
