'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import styles from './row-actions.module.css'

/** The owning row marks its hover/focus boundary with data-row-actions-scope. */
export const RowActions = ({
  children,
  className,
  visible = false
}: {
  children: ReactNode
  className?: string
  visible?: boolean
}) => (
  <div
    data-row-actions
    data-visible={visible || undefined}
    className={cn('inline-flex shrink-0 items-center gap-1', styles.actions, className)}
  >
    {children}
  </div>
)

export const RowActionButton = ({ label, ...props }: ComponentProps<typeof Button> & { label: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        {...props}
        aria-label={label}
      />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)
