'use client'

import * as React from 'react'
import { Toast as ToastPrimitives } from '@base-ui/react/toast'
import { IconX } from '@tabler/icons-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { floatingSurfaceClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed right-0 bottom-0 z-100 flex max-h-dvh w-full flex-col gap-3 p-4 sm:right-4 sm:bottom-4 md:max-w-105',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = 'ToastViewport'

const toastVariants = cva(
  'group pointer-events-auto relative isolate flex w-full items-start justify-between gap-3 overflow-hidden rounded-panel p-4 pr-10 shadow-emphasis transition-all data-[ending-style]:fade-out-80 data-[ending-style]:slide-out-to-right-full data-[ending-style]:animate-out data-[starting-style]:animate-in data-[starting-style]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        neutral: cn(floatingSurfaceClassName, 'border-primary/35'),
        info: cn(floatingSurfaceClassName, 'border-info/45 bg-info/12'),
        success: cn(floatingSurfaceClassName, 'border-success/45 bg-success/12'),
        warning: cn(floatingSurfaceClassName, 'border-warning/45 bg-warning/12'),
        danger: cn(floatingSurfaceClassName, 'danger border-danger/45 bg-danger/12 text-foreground')
      }
    },
    defaultVariants: {
      variant: 'neutral'
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
Toast.displayName = 'Toast'

const ToastContent = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Content>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Content
    ref={ref}
    className={cn('grid flex-1 gap-1 pr-2', className)}
    {...props}
  />
))
ToastContent.displayName = 'ToastContent'

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    aria-label='Close'
    className={cn(
      'absolute right-3 top-3 z-10 rounded-control p-1 text-foreground-muted opacity-0 transition-[background-color,color,opacity] hover:bg-surface-band/80 hover:text-foreground focus:opacity-100 focus:bg-surface-band/80 focus:text-foreground focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.danger]:text-danger group-[.danger]:hover:bg-danger/16 group-[.danger]:hover:text-danger group-[.danger]:focus:ring-danger/60',
      className
    )}
    {...props}
  >
    <IconX className='size-4' />
    <span className='sr-only'>Close</span>
  </ToastPrimitives.Close>
))
ToastClose.displayName = 'ToastClose'

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-medium tracking-wide [&+p]:text-xs', className)}
    {...props}
  />
))
ToastTitle.displayName = 'ToastTitle'

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm leading-5 text-foreground-muted group-[.danger]:text-foreground', className)}
    {...props}
  />
))
ToastDescription.displayName = 'ToastDescription'

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

export { type ToastProps, ToastProvider, ToastViewport, Toast, ToastContent, ToastTitle, ToastDescription, ToastClose }
