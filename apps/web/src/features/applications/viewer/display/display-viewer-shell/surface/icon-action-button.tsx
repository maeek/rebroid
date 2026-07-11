'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const IconActionButton = ({
  label,
  disabled,
  onClick,
  children,
  className
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type='button'
        size='icon-md'
        variant='secondary'
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        className={cn('size-6', className)}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)
