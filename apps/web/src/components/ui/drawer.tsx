'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import { dialogSurfaceClassName, overlayClassName, triggerResetClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Root> & {
  shouldScaleBackground?: boolean
}

const Drawer = ({ shouldScaleBackground: _shouldScaleBackground = true, ...props }: DrawerProps) => (
  <DrawerPrimitive.Root {...props} />
)
Drawer.displayName = 'Drawer'

const DrawerTrigger = ({
  asChild,
  children,
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger> & {
  asChild?: boolean
}) => {
  const view = getBaseRender(asChild, children)

  return (
    <DrawerPrimitive.Trigger
      render={view}
      className={cn(!asChild && triggerResetClassName, className)}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </DrawerPrimitive.Trigger>
  )
}
DrawerTrigger.displayName = 'DrawerTrigger'

const DrawerPortal = DrawerPrimitive.Portal

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Backdrop>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Backdrop
    ref={ref}
    className={cn('fixed inset-0 z-50', overlayClassName, className)}
    {...props}
  />
))
DrawerOverlay.displayName = 'DrawerOverlay'

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    {/* Clipping keeps the translated popup from turning its viewport into a scroll container during a swipe. */}
    <DrawerPrimitive.Viewport className='pointer-events-none fixed inset-0 z-50 flex items-end overflow-clip'>
      <DrawerPrimitive.Popup
        ref={ref}
        className={cn(
          'pointer-events-auto flex max-h-dvh w-full flex-col overflow-clip rounded-t-[10px] p-0 [transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-200 ease-out data-[ending-style]:[transform:translateY(100%)] data-[starting-style]:[transform:translateY(100%)] data-[swiping]:transition-none motion-reduce:transition-none',
          dialogSurfaceClassName,
          className
        )}
        {...props}
      >
        <div
          aria-hidden='true'
          className='flex h-8 shrink-0 touch-none items-center justify-center select-none'
        >
          <div className='h-1 w-10 rounded-full bg-foreground-muted/55' />
        </div>
        <DrawerPrimitive.Content className='flex min-h-0 flex-col'>{children}</DrawerPrimitive.Content>
      </DrawerPrimitive.Popup>
    </DrawerPrimitive.Viewport>
  </DrawerPortal>
))
DrawerContent.displayName = 'DrawerContent'

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn('text-lg font-medium leading-none tracking-tight', className)}
    {...props}
  />
))
DrawerTitle.displayName = 'DrawerTitle'

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn('text-sm text-foreground-muted', className)}
    {...props}
  />
))
DrawerDescription.displayName = 'DrawerDescription'

export { Drawer, DrawerTrigger, DrawerContent, DrawerTitle, DrawerDescription }
