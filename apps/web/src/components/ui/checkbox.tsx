'use client'

import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { IconCheck, IconMinus } from '@tabler/icons-react'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, indeterminate, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    indeterminate={indeterminate}
    className={cn(
      'peer size-4 shrink-0 rounded-[0.4rem] transition-[background-color,border-color,color,box-shadow] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
      controlSurfaceClassName,
      controlHoverClassName,
      focusRingClassName,
      'data-[checked]:!border-primary/60 data-[checked]:!bg-primary data-[checked]:!text-primary-foreground',
      'data-[indeterminate]:border-primary/60 data-[indeterminate]:text-primary',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      {indeterminate ? (
        <IconMinus
          aria-hidden
          className='size-4'
        />
      ) : (
        <IconCheck
          aria-hidden
          className='size-4'
        />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
