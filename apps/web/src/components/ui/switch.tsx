'use client'

import * as React from 'react'
import { Switch as SwitchPrimitives } from '@base-ui/react/switch'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface-classes'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-[background-color,border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary/35 data-[checked]:bg-primary data-[unchecked]:border-control-border-strong/45 data-[unchecked]:bg-control-hover oled:data-[unchecked]:border-control-border-strong/60',
      controlSurfaceClassName,
      controlHoverClassName,
      focusRingClassName,
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block size-4 rounded-full border border-control-border/60 bg-surface-elevated shadow-lg ring-0 transition-[background-color,border-color,transform] data-[checked]:translate-x-4 data-[checked]:border-primary-foreground/30 data-[checked]:bg-primary-foreground data-[unchecked]:translate-x-0 data-[unchecked]:bg-surface-elevated dark:data-[unchecked]:border-control-border-strong/60 dark:data-[unchecked]:bg-control-border-strong oled:data-[unchecked]:border-control-border-strong oled:data-[unchecked]:bg-control-border-strong'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
