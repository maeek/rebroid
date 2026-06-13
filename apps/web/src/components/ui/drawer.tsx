'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import { floatingSurfaceClassName, overlayClassName, triggerResetClassName } from '@/components/ui/surface-classes'
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
    <DrawerPrimitive.Viewport className='pointer-events-none fixed inset-0 z-50 flex items-end overflow-x-hidden'>
      <DrawerPrimitive.Popup
        ref={ref}
        className={cn(
          'scrollbar-thin pointer-events-auto inset-x-0 bottom-0 mt-24 flex max-h-dvh w-full flex-col overflow-x-hidden rounded-t-[10px] p-0 data-[closed]:animate-out data-[open]:animate-in data-[closed]:slide-out-to-bottom data-[open]:slide-in-from-bottom',
          floatingSurfaceClassName,
          className
        )}
        {...props}
      >
        <DrawerPrimitive.Content className='min-h-0 overflow-hidden'>
          <div className='mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted-foreground/55' />
          {children}
        </DrawerPrimitive.Content>
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
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
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
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DrawerDescription.displayName = 'DrawerDescription'

export { Drawer, DrawerTrigger, DrawerContent, DrawerTitle, DrawerDescription }
