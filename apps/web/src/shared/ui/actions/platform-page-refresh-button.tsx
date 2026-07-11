'use client'

import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const PlatformPageRefreshButton = ({
  isRefreshing,
  onRefresh,
  label = 'Refresh',
  disabled
}: {
  isRefreshing?: boolean
  onRefresh: () => void
  label?: string
  disabled?: boolean
}) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-md'
          aria-label={label}
          disabled={disabled || isRefreshing}
          onClick={onRefresh}
        >
          {isRefreshing ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)
