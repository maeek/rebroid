'use client'

import * as React from 'react'
import { Cross2Icon } from '@radix-ui/react-icons'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed right-0 bottom-0 z-100 flex max-h-screen w-full flex-col gap-3 p-4 sm:right-4 sm:bottom-4 md:max-w-105',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  'group pointer-events-auto relative isolate flex w-full items-start justify-between gap-3 overflow-hidden rounded-lg border p-4 pr-10 shadow-2xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default:
          "border-primary/35 bg-transparent text-foreground shadow-black/45 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-card/95 before:backdrop-blur-xl before:content-[''] supports-backdrop-filter:before:bg-card/90",
        destructive:
          "destructive group border-destructive/35 bg-transparent text-destructive-foreground shadow-black/45 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-card/62 before:backdrop-blur-xl before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-destructive/24 after:content-[''] supports-backdrop-filter:before:bg-card/62"
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border/75 bg-secondary/60 px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-destructive-foreground/18 group-[.destructive]:bg-destructive-foreground/10 group-[.destructive]:text-destructive-foreground group-[.destructive]:hover:bg-destructive-foreground/16 group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive/60',
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground opacity-0 transition-[background-color,color,opacity] hover:bg-secondary/80 hover:text-foreground focus:opacity-100 focus:bg-secondary/80 focus:text-foreground focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-destructive-foreground/72 group-[.destructive]:hover:bg-destructive-foreground/14 group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive/60 group-[.destructive]:focus:ring-offset-destructive/35',
      className
    )}
    toast-close=''
    {...props}
  >
    <Cross2Icon className='size-4' />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-semibold tracking-wide [&+div]:text-xs', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      'text-sm leading-5 text-secondary-foreground group-[.destructive]:text-destructive-foreground/88',
      className
    )}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction
}
