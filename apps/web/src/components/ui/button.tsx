import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PrimitiveSlot } from '@/components/ui/primitive-slot'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface-classes'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default:
          'border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_0_15px_0_rgba(0,0,0,0.16)] dark:shadow-[inset_0_0_10px_0_rgba(255,255,255,0.16)]',
        destructive:
          'border-destructive/30 bg-destructive text-destructive-foreground hover:bg-destructive/88 shadow-[inset_0_0_15px_0_rgba(0,0,0,0.16)] dark:shadow-[inset_0_0_10px_0_rgba(255,255,255,0.12)]',
        outline: cn(controlSurfaceClassName, controlHoverClassName, 'hover:text-foreground'),
        secondary:
          'border-border/70 bg-secondary text-secondary-foreground hover:bg-secondary/86 hover:text-foreground shadow-[inset_0_0_20px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_20px_0_rgba(255,255,255,0.05)]',
        input: cn(controlSurfaceClassName, controlHoverClassName),
        ghost:
          'border-transparent hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/60 shadow-[inset_0_0_20px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_20px_0_rgba(255,255,255,0.05)]',
        link: 'text-primary underline-offset-4 hover:underline border-none',
        update:
          'border-success/30 bg-success/14 text-foreground underline-offset-4 hover:bg-success/22 shadow-[inset_0_0_20px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_20px_0_rgba(255,255,255,0.05)]'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? PrimitiveSlot : 'button'

  return (
    <Comp
      data-slot='button'
      className={cn(focusRingClassName, buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
