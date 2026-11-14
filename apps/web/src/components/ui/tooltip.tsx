'use client'

import * as React from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import { floatingLayerClassName, floatingSurfaceClassName, triggerResetClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import styles from './tooltip.module.css'

const TooltipProvider = ({
  delayDuration = 350,
  skipDelayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider> & {
  delayDuration?: number
  skipDelayDuration?: number
}) => (
  <TooltipPrimitive.Provider
    delay={delayDuration}
    timeout={skipDelayDuration}
    {...props}
  />
)

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = ({
  asChild,
  children,
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & {
  asChild?: boolean
}) => {
  const view = getBaseRender(asChild, children)

  return (
    <TooltipPrimitive.Trigger
      render={view}
      className={cn(!asChild && triggerResetClassName, className)}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </TooltipPrimitive.Trigger>
  )
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> & {
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'right' | 'bottom' | 'left'
    sideOffset?: number
  }
>(({ className, align = 'center', side = 'top', sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner
      align={align}
      className={floatingLayerClassName}
      side={side}
      sideOffset={sideOffset}
    >
      <TooltipPrimitive.Popup
        ref={ref}
        className={cn(
          'z-50 overflow-hidden rounded-control px-3 py-1.5 text-xs',
          styles.popup,
          floatingSurfaceClassName,
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = 'TooltipContent'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
