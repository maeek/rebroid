'use client'

import type { ComponentProps, ReactNode } from 'react'
import { MutationButton } from '@/components/ui/mutation-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const AiComposerAction = ({
  label,
  shortcut,
  className,
  children,
  size = 'icon-md',
  ...props
}: Pick<
  ComponentProps<typeof MutationButton>,
  'onClick' | 'pending' | 'disabled' | 'variant' | 'size' | 'className'
> & {
  label: string
  shortcut?: string
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <MutationButton
        {...props}
        type='button'
        size={size}
        className={cn('rounded-full motion-reduce:transition-none', className)}
        aria-label={label}
        pendingLabel={<span className='sr-only'>{label}</span>}
      >
        {children}
      </MutationButton>
    </TooltipTrigger>
    <TooltipContent>
      {label}
      {shortcut ? <kbd className='ml-2 text-foreground-muted'>{shortcut}</kbd> : null}
    </TooltipContent>
  </Tooltip>
)
