'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { IconCheck, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import {
  controlHoverClassName,
  controlSurfaceClassName,
  floatingSurfaceClassName,
  focusRingClassName,
  interactiveItemClassName
} from '@/components/ui/surface-classes'
import { cn } from '@/lib/utils'

type SelectRootProps<Value extends string = string> = Omit<
  SelectPrimitive.Root.Props<Value>,
  'defaultValue' | 'multiple' | 'onValueChange' | 'value'
> & {
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  value?: Value
}

function Select<Value extends string = string>({ onValueChange, ...props }: SelectRootProps<Value>) {
  return (
    <SelectPrimitive.Root
      data-slot='select'
      onValueChange={value => {
        if (value !== null) {
          onValueChange?.(value)
        }
      }}
      {...props}
    />
  )
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return (
    <SelectPrimitive.Value
      data-slot='select-value'
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  asChild,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default'
  asChild?: boolean
}) {
  const view = getBaseRender(asChild, children)

  return (
    <SelectPrimitive.Trigger
      data-slot='select-trigger'
      data-size={size}
      render={view}
      className={cn(
        "data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex w-fit items-center justify-between gap-2 rounded-md px-4 py-3 text-sm whitespace-nowrap transition-[color,box-shadow,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        controlSurfaceClassName,
        controlHoverClassName,
        focusRingClassName,
        className
      )}
      {...props}
    >
      {getBaseChildren(asChild, children)}
      <SelectPrimitive.Icon>
        <IconChevronDown className='size-4 opacity-60' />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> & {
  position?: 'popper' | 'item-aligned'
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}) {
  const alignItemWithTrigger = position !== 'popper'

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot='select-content'
          className={cn(
            'relative z-50 max-h-[min(var(--available-height),24rem)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            {
              'min-w-[var(--anchor-width)]': position === 'popper'
            },
            floatingSurfaceClassName,
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className='p-1'>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot='select-item'
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 py-1.5 pr-8 pl-2 text-sm select-none [&_svg:not([class*='text-'])]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        interactiveItemClassName,
        className
      )}
      {...props}
    >
      <span className='absolute right-2 flex size-3.5 items-center justify-center'>
        <SelectPrimitive.ItemIndicator>
          <IconCheck className='size-4' />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot='select-scroll-up-button'
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <IconChevronUp className='size-4' />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot='select-scroll-down-button'
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <IconChevronDown className='size-4' />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
