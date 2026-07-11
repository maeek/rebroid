'use client'

import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { IconCheck } from '@tabler/icons-react'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer size-4 shrink-0 rounded-[0.4rem] transition-[background-color,border-color,color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
      controlSurfaceClassName,
      controlHoverClassName,
      focusRingClassName,
      'data-[checked]:!border-primary/60 data-[checked]:!bg-primary data-[checked]:!text-primary-foreground',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <IconCheck className='size-4' />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
