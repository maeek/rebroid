'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { IconX } from '@tabler/icons-react'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import { EditorFormContext, EditorSectionContext } from '@/components/ui/editor-form-context'
import { dialogSurfaceClassName, overlayClassName, triggerResetClassName } from '@/components/ui/surface'
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
        'fixed inset-0 z-50 opacity-100 transition-opacity duration-200 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none',
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
  'data-editor-dialog': editorDialog,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  showCloseButton?: boolean
  'data-editor-dialog'?: string
}) {
  return (
    <DialogPortal data-slot='dialog-portal'>
      <DialogOverlay />
      <DialogPrimitive.Viewport className='scrollbar-thin pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto p-4'>
        <DialogPrimitive.Popup
          data-slot='dialog-content'
          data-editor-dialog={editorDialog}
          className={cn(
            'scrollbar-thin pointer-events-auto relative grid w-full max-h-[calc(100dvh-2rem)] max-w-full grid-cols-[minmax(0,1fr)] gap-4 overflow-x-hidden overflow-y-auto overscroll-contain rounded-panel p-5 opacity-100 shadow-emphasis shadow-black/45 transition-[opacity,scale] duration-200 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:transition-none sm:max-w-lg sm:p-6',
            dialogSurfaceClassName,
            className
          )}
          {...props}
        >
          <EditorFormContext.Provider value={editorDialog !== undefined}>
            <EditorSectionContext.Provider value={editorDialog !== undefined}>{children}</EditorSectionContext.Provider>
          </EditorFormContext.Provider>
          <Visible when={showCloseButton}>
            <DialogPrimitive.Close
              data-slot='dialog-close'
              className="touch-control touch-manipulation ring-offset-background focus-visible:ring-ring absolute end-2 top-2 inline-flex size-8 items-center justify-center rounded-control text-foreground-muted transition-colors hover:bg-surface-band/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <IconX aria-hidden />
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
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 [&_button]:max-w-full [&_button]:touch-manipulation',
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot='dialog-title'
      className={cn(
        'text-lg leading-snug font-medium text-balance [overflow-wrap:anywhere] [[data-slot=dialog-content]:has(>[data-slot=dialog-close])_&]:pe-8',
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot='dialog-description'
      className={cn('text-sm leading-relaxed text-foreground-muted [overflow-wrap:anywhere]', className)}
      {...props}
    />
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger }
