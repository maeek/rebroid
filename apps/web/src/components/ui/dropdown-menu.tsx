'use client'

import * as React from 'react'
import { Menu as DropdownMenuPrimitive } from '@base-ui/react/menu'
import { IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import {
  floatingLayerClassName,
  menuSurfaceClassName,
  interactiveItemClassName,
  selectableItemClassName,
  triggerResetClassName
} from '@/components/ui/surface'
import { cn } from '@/lib/utils'

type MenuSelectEvent = React.MouseEvent<HTMLElement> & {
  preventBaseUIHandler?: () => void
}

type WithAsChild = {
  asChild?: boolean
}

type WithInset = {
  inset?: boolean
}

type PositionerProps = {
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}

function handleMenuSelect(
  event: MenuSelectEvent,
  onSelect?: (event: MenuSelectEvent) => void,
  onClick?: React.MouseEventHandler<HTMLElement>
) {
  onSelect?.(event)
  onClick?.(event)
  if (event.defaultPrevented) {
    event.preventBaseUIHandler?.()
  }
}

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = ({
  asChild,
  children,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger> & WithAsChild) => {
  const view = getBaseRender(asChild, children)

  return (
    <DropdownMenuPrimitive.Trigger
      render={view}
      className={cn(!asChild && triggerResetClassName, className)}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </DropdownMenuPrimitive.Trigger>
  )
}

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.SubmenuRoot

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubmenuTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubmenuTrigger> &
    WithInset &
    WithAsChild & { indicatorSide?: 'left' | 'right' }
>(({ className, inset, children, asChild, indicatorSide = 'right', ...props }, ref) => {
  const view = getBaseRender(asChild, children)
  const Chevron = indicatorSide === 'left' ? IconChevronLeft : IconChevronRight

  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      ref={ref}
      render={view}
      className={cn(
        'flex cursor-default select-none items-center px-2 py-1.5 text-sm data-[open]:bg-control-hover',
        interactiveItemClassName,
        {
          'pl-8': inset
        },
        className
      )}
      {...props}
    >
      {getBaseChildren(asChild, children)}
      <Chevron
        aria-hidden='true'
        className='ml-auto size-4'
      />
    </DropdownMenuPrimitive.SubmenuTrigger>
  )
})
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger'

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Popup> &
    PositionerProps &
    Pick<React.ComponentProps<typeof DropdownMenuPrimitive.Positioner>, 'collisionPadding'>
>(({ className, sideOffset = 4, align = 'start', side, collisionPadding, ...props }, ref) => (
  <DropdownMenuPrimitive.Positioner
    align={align}
    className={floatingLayerClassName}
    collisionPadding={collisionPadding}
    side={side}
    sideOffset={sideOffset}
  >
    <DropdownMenuPrimitive.Popup
      ref={ref}
      className={cn(
        'scrollbar-thin z-50 max-h-(--available-height) min-w-32 overflow-x-hidden overflow-y-auto overscroll-contain p-1 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--transform-origin)',
        menuSurfaceClassName,
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Positioner>
))
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent'

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Popup> & PositionerProps
>(({ className, sideOffset = 4, align = 'start', side, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Positioner
      align={align}
      className={floatingLayerClassName}
      side={side}
      sideOffset={sideOffset}
    >
      <DropdownMenuPrimitive.Popup
        ref={ref}
        className={cn(
          'z-50 min-w-32 overflow-hidden rounded-control p-1 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          menuSurfaceClassName,
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Positioner>
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>, 'onClick'> &
    WithInset &
    WithAsChild & {
      onClick?: React.MouseEventHandler<HTMLElement>
      onSelect?: (event: MenuSelectEvent) => void
    }
>(({ className, inset, asChild, children, onSelect, onClick, ...props }, ref) => {
  const view = getBaseRender(asChild, children)

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      render={view}
      className={cn(
        'relative flex cursor-default select-none items-center px-2 py-1.5 text-sm',
        interactiveItemClassName,
        selectableItemClassName,
        {
          'pl-8': inset
        },
        className
      )}
      onClick={event => handleMenuSelect(event, onSelect, onClick)}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </DropdownMenuPrimitive.Item>
  )
})
DropdownMenuItem.displayName = 'DropdownMenuItem'

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) => (
  <DropdownMenuPrimitive.RadioItem
    closeOnClick
    className={cn('flex cursor-default items-center gap-2 px-2 py-1.5 text-sm', selectableItemClassName, className)}
    {...props}
  >
    {children}
    <DropdownMenuPrimitive.RadioItemIndicator
      keepMounted
      className='ml-auto size-4 shrink-0 text-primary data-[unchecked]:invisible'
    >
      <IconCheck className='size-4' />
    </DropdownMenuPrimitive.RadioItemIndicator>
  </DropdownMenuPrimitive.RadioItem>
)

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.GroupLabel>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.GroupLabel> & WithInset
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.GroupLabel
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-medium',
      {
        'pl-8': inset
      },
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border/75', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
}
