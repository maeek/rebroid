'use client'

import * as React from 'react'
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import { handleMenuSelect, type MenuSelectEvent } from '@/components/ui/menu-select-event'
import { actionMenuItemClassName, actionMenuSurfaceClassName, floatingLayerClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { popupFadeClassName } from './feedback-motion'

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
      <ContextMenuPrimitive.Positioner
        className={floatingLayerClassName}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          data-slot='context-menu-content'
          className={cn(
            'scrollbar-thin z-50 max-h-[min(var(--available-height),24rem)] overflow-x-hidden overflow-y-auto',
            popupFadeClassName,
            actionMenuSurfaceClassName,
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
  variant?: 'default' | 'danger'
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
        "relative flex cursor-default items-center select-none data-[variant=danger]:text-danger data-[variant=danger]:data-[highlighted]:bg-danger/10 data-[variant=danger]:data-[highlighted]:text-danger data-[variant=danger]:*:[svg]:!text-danger [&_svg:not([class*='text-'])]:text-foreground-muted data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        actionMenuItemClassName,
        className
      )}
      onClick={event => handleMenuSelect(event, onSelect, onClick)}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </ContextMenuPrimitive.Item>
  )
}

export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem }
