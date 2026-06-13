'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { IconX } from '@tabler/icons-react'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import { floatingSurfaceClassName, overlayClassName, triggerResetClassName } from '@/components/ui/surface-classes'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <DialogPrimitive.Root
      data-slot='dialog'
      {...props}
    />
  )
}

function DialogTrigger({
  asChild,
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger> & {
  asChild?: boolean
}) {
  const view = getBaseRender(asChild, children)

  return (
    <DialogPrimitive.Trigger
      data-slot='dialog-trigger'
      render={view}
      className={cn(!asChild && triggerResetClassName, className)}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </DialogPrimitive.Trigger>
  )
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return (
    <DialogPrimitive.Portal
      data-slot='dialog-portal'
      {...props}
    />
  )
}

function DialogClose({
  asChild,
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close> & {
  asChild?: boolean
}) {
  const view = getBaseRender(asChild, children)

  return (
    <DialogPrimitive.Close
      data-slot='dialog-close'
      render={view}
      className={cn(!asChild && triggerResetClassName, className)}
      {...props}
    >
      {getBaseChildren(asChild, children)}
    </DialogPrimitive.Close>
  )
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot='dialog-overlay'
      className={cn(
        'fixed inset-0 z-50 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0',
        overlayClassName,
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot='dialog-portal'>
      <DialogOverlay />
      <DialogPrimitive.Viewport className='pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4'>
        <DialogPrimitive.Popup
          data-slot='dialog-content'
          className={cn(
            'pointer-events-auto relative grid w-full max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-lg p-6 shadow-2xl shadow-black/45 duration-200 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 sm:max-w-lg',
            floatingSurfaceClassName,
            className
          )}
          {...props}
        >
          {children}
          <Visible when={showCloseButton}>
            <DialogPrimitive.Close
              data-slot='dialog-close'
              className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs p-1 text-muted-foreground opacity-80 transition-[background-color,color,opacity] hover:bg-secondary/80 hover:text-foreground hover:opacity-100 focus:bg-secondary/80 focus:text-foreground focus:ring-2 focus:ring-offset-2 focus:outline-hidden data-[open]:bg-secondary/65 data-[open]:text-secondary-foreground disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <IconX />
              <span className='sr-only'>Close</span>
            </DialogPrimitive.Close>
          </Visible>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='dialog-header'
      className={cn('flex flex-col gap-2 text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='dialog-footer'
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot='dialog-title'
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot='dialog-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger }
