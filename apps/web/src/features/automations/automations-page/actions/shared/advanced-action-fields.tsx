import type { ReactNode } from 'react'
import {
  Disclosure,
  DisclosureChevron,
  DisclosureSummary,
  disclosureContentClassName
} from '@/components/ui/disclosure'

export function AdvancedActionFields({
  children,
  label,
  summary,
  open
}: {
  children: ReactNode
  label: string
  summary?: string
  open?: boolean
}) {
  return (
    <Disclosure open={open || undefined}>
      <DisclosureSummary className='flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 rounded-control px-2 py-2 text-sm font-medium hover:bg-surface-band/50'>
        <DisclosureChevron
          direction='right'
          className='size-4 shrink-0 text-foreground-muted'
        />
        <span>{label}</span>
        {summary ? <span className='text-xs font-normal text-foreground-muted'>· {summary}</span> : null}
      </DisclosureSummary>
      <div className={disclosureContentClassName}>
        <div className='grid gap-4 pt-2 pb-1'>{children}</div>
      </div>
    </Disclosure>
  )
}
