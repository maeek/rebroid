'use client'

import * as React from 'react'
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import { floatingSurfaceClassName, interactiveItemClassName } from '@/components/ui/surface-classes'
import { cn } from '@/lib/utils'

type MenuSelectEvent = React.MouseEvent<HTMLElement> & {
  preventBaseUIHandler?: () => void
}

function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return (
    <ContextMenuPrimitive.Root
      data-slot='context-menu'
      {...props}
    />
  )
}

function ContextMenuTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger> & {
  asChild?: boolean
}) {
  const view = getBaseRender(asChild, children)

  return (
    <ContextMenuPrimitive.Trigger
      data-slot='context-menu-trigger'
      render={view}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </ContextMenuPrimitive.Trigger>
  )
}

function ContextMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Popup> & {
  sideOffset?: number
}) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner sideOffset={sideOffset}>
        <ContextMenuPrimitive.Popup
          data-slot='context-menu-content'
          className={cn(
            'z-50 max-h-[min(var(--available-height),24rem)] min-w-32 overflow-x-hidden overflow-y-auto rounded-md p-1 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            floatingSurfaceClassName,
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = 'default',
  asChild,
  children,
  onSelect,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof ContextMenuPrimitive.Item>, 'onClick'> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
  asChild?: boolean
  onClick?: React.MouseEventHandler<HTMLElement>
  onSelect?: (event: MenuSelectEvent) => void
}) {
  const view = getBaseRender(asChild, children)

  return (
    <ContextMenuPrimitive.Item
      data-slot='context-menu-item'
      data-inset={inset}
      data-variant={variant}
      render={view}
      className={cn(
        "relative flex cursor-default items-center gap-2 px-2 py-1.5 text-sm select-none data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        interactiveItemClassName,
        className
      )}
      onClick={event => {
        onSelect?.(event)
        onClick?.(event)
        if (event.defaultPrevented) {
          event.preventBaseUIHandler?.()
        }
      }}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </ContextMenuPrimitive.Item>
  )
}

export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem }
