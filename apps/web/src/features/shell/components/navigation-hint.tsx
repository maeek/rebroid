import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const NavigationHint = ({
  label,
  children,
  side = 'right'
}: {
  label: string
  children: ReactElement
  side?: 'bottom' | 'right'
}) => (
  <Tooltip>
    <TooltipTrigger
      asChild
      delay={0}
    >
      {children}
    </TooltipTrigger>
    <TooltipContent
      data-slot='navigation-hint'
      side={side}
      sideOffset={8}
    >
      {label}
    </TooltipContent>
  </Tooltip>
)
