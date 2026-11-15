'use client'

import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { fieldFeedbackClassName } from './feedback-motion'
import { useFieldModified, type FieldPath } from './field-changes'

export const ModifiedIndicator = ({ modified }: { modified: boolean }) => (
  <Tooltip disabled={!modified}>
    <TooltipTrigger asChild>
      <span
        aria-hidden
        data-slot='modified-indicator'
        className='absolute -left-3 top-0 inline-flex h-5 w-2 items-center justify-center touch:h-6'
      >
        <span
          data-visible={modified}
          className={cn('size-1.5 rounded-full bg-primary', fieldFeedbackClassName)}
        />
      </span>
    </TooltipTrigger>
    <TooltipContent>Unsaved change</TooltipContent>
  </Tooltip>
)

export const DraftFieldLabel = ({
  field,
  children,
  modified
}: {
  field?: FieldPath
  children: ReactNode
  modified?: boolean
}) => {
  const fieldModified = useFieldModified(field)
  const changed = modified ?? fieldModified
  return (
    <span
      className='relative'
      data-modified={changed || undefined}
    >
      {changed !== undefined ? <ModifiedIndicator modified={changed} /> : null}
      {children}
      {changed ? <span className='sr-only'> (unsaved change)</span> : null}
    </span>
  )
}
