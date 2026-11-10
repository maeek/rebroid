import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const NavigationHint = ({ label, children }: { label: string; children: ReactElement }) => (
  <Tooltip>
    <TooltipTrigger
      asChild
      delay={0}
    >
      {children}
    </TooltipTrigger>
    <TooltipContent
      data-slot='navigation-hint'
      side='right'
      sideOffset={8}
    >
      {label}
    </TooltipContent>
  </Tooltip>
)
