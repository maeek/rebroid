import * as React from 'react'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-25 min-w-0 w-full rounded-control px-3 py-2 text-sm transition-[background-color,border-color,color,box-shadow] duration-75 placeholder:text-foreground-muted disabled:cursor-not-allowed disabled:opacity-50',
        controlSurfaceClassName,
        controlHoverClassName,
        focusRingClassName,
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
