'use client'

import * as React from 'react'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  'defaultValue' | 'onValueChange' | 'onValueCommitted' | 'value'
> & {
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
  value?: number[]
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, onValueChange, onValueCommit, 'aria-label': ariaLabel, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center py-1.5', className)}
      aria-label={ariaLabel}
      onValueChange={value => onValueChange?.(Array.isArray(value) ? [...value] : [value])}
      onValueCommitted={value => onValueCommit?.(Array.isArray(value) ? [...value] : [value])}
      {...props}
    >
      <SliderPrimitive.Control className='group/slider relative flex h-6 w-full touch-none select-none items-center'>
        <SliderPrimitive.Track className='relative h-2 w-full grow overflow-hidden rounded-full border border-control-border/35 bg-control/78 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition-[background-color,border-color,box-shadow] group-hover/slider:border-control-border-strong/45 group-hover/slider:bg-control-hover/82 dark:bg-black/18 oled:bg-control-hover/78'>
          <SliderPrimitive.Indicator className='absolute h-full rounded-full bg-linear-to-r from-primary/72 via-primary/92 to-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_0_18px_hsl(var(--primary)/0.18)]' />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className='block size-5 rounded-full border-2 border-control-border-strong/55 bg-surface-elevated shadow-[0_2px_8px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.3)] transition-[transform,background-color,border-color,box-shadow] hover:scale-105 hover:border-ring hover:shadow-[0_4px_14px_rgba(15,23,42,0.24),0_0_0_5px_hsl(var(--primary)/0.1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:bg-control dark:shadow-[0_2px_10px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] oled:bg-control-hover oled:shadow-none'
          getAriaLabel={ariaLabel ? () => ariaLabel : undefined}
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
)
Slider.displayName = 'Slider'

export { Slider }
